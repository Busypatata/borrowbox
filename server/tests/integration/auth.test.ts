import { beforeEach, describe, expect, it } from 'vitest';
import { API, PASSWORD, app, getOutbox, login, makeUser, prisma, request, resetDb, tokenFromEmail, clearOutbox } from './helpers';

beforeEach(resetDb);

describe('registration & login', () => {
  it('registers, never returns the hash, and requires verification for sensitive actions', async () => {
    const u = await makeUser('Una Unverified', { verify: false });
    const me = await u.get('/auth/me');
    expect(me.body.data.user.emailVerified).toBe(false);
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|\$argon2/);
    const create = await u.post('/items', { title: 'abc' });
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('stores an argon2id hash, not the password', async () => {
    await makeUser('Hash Check');
    const row = await prisma.user.findUniqueOrThrow({ where: { email: 'hash.check@example.com' } });
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row.passwordHash).not.toContain(PASSWORD);
  });

  it('does not reveal whether an email exists on duplicate registration', async () => {
    await makeUser('Dup User');
    const res = await request(app).post(`${API}/auth/register`).send({ name: 'Dup Again', email: 'dup.user@example.com', password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true });
    expect(res.status).toBe(202);
    expect(await prisma.user.count({ where: { email: 'dup.user@example.com' } })).toBe(1);
  });

  it('validates input with field errors', async () => {
    const res = await request(app).post(`${API}/auth/register`).send({ name: 'A', email: 'bad', password: 'x', confirmPassword: 'y', acceptTerms: false });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('gives the same generic error for wrong password and unknown email', async () => {
    await makeUser('Real User');
    const wrong = await request(app).post(`${API}/auth/login`).send({ email: 'real.user@example.com', password: 'nope-nope-1' });
    const unknown = await request(app).post(`${API}/auth/login`).send({ email: 'ghost@example.com', password: 'nope-nope-1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('sets an HTTP-only session cookie and exposes no token in the body', async () => {
    await makeUser('Cookie Kid');
    const res = await request(app).post(`${API}/auth/login`).send({ email: 'cookie.kid@example.com', password: PASSWORD });
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toMatch(/bb_sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(res.body)).not.toMatch(/bb_sid/);
  });

  it('logout invalidates the session; logout-all kills other sessions', async () => {
    const a = await makeUser('Multi Session');
    const b = await login(a.email);
    expect((await a.post('/auth/logout')).status).toBe(204);
    expect((await a.get('/auth/me')).body.data.user).toBeNull();
    expect((await b.get('/auth/me')).body.data.user).not.toBeNull();
    const c = await login(a.email);
    expect((await c.post('/auth/logout-all')).status).toBe(204);
    expect((await b.get('/auth/me')).body.data.user).toBeNull();
  });
});

describe('CSRF', () => {
  it('rejects state-changing authenticated requests without the token', async () => {
    const u = await makeUser('Csrf Test');
    const res = await u.agent.patch(`${API}/users/me`).send({ name: 'Hacked' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });
  it('rejects a foreign Origin', async () => {
    const u = await makeUser('Origin Test');
    const res = await u.agent.patch(`${API}/users/me`).set('Origin', 'https://evil.example').set('X-CSRF-Token', u.csrf).send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });
  it('rejects a wrong token', async () => {
    const u = await makeUser('Csrf Wrong');
    const res = await u.agent.patch(`${API}/users/me`).set('X-CSRF-Token', 'wrong').send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });
});

describe('email verification', () => {
  it('verifies once; the token cannot be reused', async () => {
    await makeUser('Verify Me', { verify: false });
    const token = tokenFromEmail('verify.me@example.com');
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token })).status).toBe(200);
    const again = await request(app).post(`${API}/auth/verify-email`).send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_TOKEN');
  });
  it('rejects expired tokens', async () => {
    await makeUser('Expire Me', { verify: false });
    const token = tokenFromEmail('expire.me@example.com');
    await prisma.emailVerificationToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token })).status).toBe(400);
  });
  it('stores only token hashes', async () => {
    await makeUser('Hash Token', { verify: false });
    const token = tokenFromEmail('hash.token@example.com');
    const rows = await prisma.emailVerificationToken.findMany();
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
  });
  it('resend returns a generic response and issues a new working token', async () => {
    const u = await makeUser('Resend Me', { verify: false });
    clearOutbox();
    const res = await u.post('/auth/resend-verification');
    expect(res.status).toBe(200);
    expect(getOutbox().length).toBe(1);
    const unknown = await request(app).post(`${API}/auth/resend-verification`).send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(200);
  });
});

describe('password reset', () => {
  it('full flow: generic response, single-use, old password dies, sessions revoked', async () => {
    const u = await makeUser('Reset Rita');
    clearOutbox();
    const unknown = await request(app).post(`${API}/auth/forgot-password`).send({ email: 'nobody@example.com' });
    const known = await request(app).post(`${API}/auth/forgot-password`).send({ email: u.email });
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    const token = tokenFromEmail(u.email);
    const NEW = 'Brand-New-Pass-42';
    const reset = await request(app).post(`${API}/auth/reset-password`).send({ token, password: NEW, confirmPassword: NEW });
    expect(reset.status).toBe(200);
    expect((await u.get('/auth/me')).body.data.user).toBeNull(); // old session revoked
    expect((await request(app).post(`${API}/auth/login`).send({ email: u.email, password: PASSWORD })).status).toBe(401);
    expect((await request(app).post(`${API}/auth/login`).send({ email: u.email, password: NEW })).status).toBe(200);
    const reuse = await request(app).post(`${API}/auth/reset-password`).send({ token, password: 'Another-Pass-77', confirmPassword: 'Another-Pass-77' });
    expect(reuse.status).toBe(400);
  });
  it('rejects expired and garbage tokens', async () => {
    const u = await makeUser('Reset Expired');
    clearOutbox();
    await request(app).post(`${API}/auth/forgot-password`).send({ email: u.email });
    const token = tokenFromEmail(u.email);
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const NEW = 'Brand-New-Pass-42';
    expect((await request(app).post(`${API}/auth/reset-password`).send({ token, password: NEW, confirmPassword: NEW })).status).toBe(400);
    expect((await request(app).post(`${API}/auth/reset-password`).send({ token: 'x'.repeat(40), password: NEW, confirmPassword: NEW })).status).toBe(400);
  });
  it('a newer reset link invalidates the older one', async () => {
    const u = await makeUser('Reset Twice');
    clearOutbox();
    await request(app).post(`${API}/auth/forgot-password`).send({ email: u.email });
    const first = tokenFromEmail(u.email);
    await request(app).post(`${API}/auth/forgot-password`).send({ email: u.email });
    const NEW = 'Brand-New-Pass-42';
    expect((await request(app).post(`${API}/auth/reset-password`).send({ token: first, password: NEW, confirmPassword: NEW })).status).toBe(400);
  });
});

describe('password change', () => {
  it('requires the current password and revokes other sessions only', async () => {
    const a = await makeUser('Change Chad');
    const b = await login(a.email);
    const bad = await a.post('/auth/change-password', { currentPassword: 'wrong', newPassword: 'Another-Pass-77', confirmPassword: 'Another-Pass-77' });
    expect(bad.status).toBe(422);
    const ok = await a.post('/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Another-Pass-77', confirmPassword: 'Another-Pass-77' });
    expect(ok.status).toBe(200);
    expect((await a.get('/auth/me')).body.data.user).not.toBeNull();
    expect((await b.get('/auth/me')).body.data.user).toBeNull();
  });
});

describe('protected endpoints', () => {
  it('require authentication', async () => {
    for (const [m, p] of [['get', '/requests/incoming'], ['get', '/notifications'], ['get', '/conversations'], ['get', '/favorites'], ['get', '/users/me/stats'], ['get', '/admin/reports']] as const) {
      const res = await request(app)[m](API + p);
      expect(res.status, p).toBe(401);
    }
  });
  it('consistent error shape for unknown routes', async () => {
    const res = await request(app).get(`${API}/nope`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
});
