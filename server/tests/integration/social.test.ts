import { beforeEach, describe, expect, it } from 'vitest';
import { API, app, futureDate, makeItem, makeUser, PASSWORD, prisma, request, resetDb } from './helpers';

beforeEach(resetDb);

describe('messaging', () => {
  async function pair() {
    const a = await makeUser('Msg Alice');
    const b = await makeUser('Msg Bob');
    const item = await makeItem(b);
    const conv = await a.post('/conversations', { recipientId: b.id, itemId: item.id });
    return { a, b, item, conv: conv.body.data as { id: string } };
  }

  it('creates one conversation per pair+item, regardless of who starts it', async () => {
    const { a, b, item, conv } = await pair();
    const again = await a.post('/conversations', { recipientId: b.id, itemId: item.id });
    const fromB = await b.post('/conversations', { recipientId: a.id, itemId: item.id });
    expect(again.body.data.id).toBe(conv.id);
    expect(fromB.body.data.id).toBe(conv.id);
    expect(await prisma.conversation.count()).toBe(1);
    expect((await a.post('/conversations', { recipientId: a.id })).status).toBe(400);
  });

  it('sends, lists, tracks unread counts, and marks read', async () => {
    const { a, b, conv } = await pair();
    expect((await a.post(`/conversations/${conv.id}/messages`, { body: 'Hello Bob' })).status).toBe(201);
    expect((await a.post(`/conversations/${conv.id}/messages`, { body: 'Still there?' })).status).toBe(201);
    const list = await b.get('/conversations');
    expect(list.body.data[0].unreadCount).toBe(2);
    expect(list.body.data[0].lastMessage.body).toBe('Still there?');
    expect((await b.get('/conversations/unread-count')).body.data.count).toBe(2);
    expect((await b.get('/users/me/stats')).body.data.unreadMessages).toBe(2);
    const msgs = await b.get(`/conversations/${conv.id}/messages`);
    expect(msgs.body.data.map((m: { body: string }) => m.body)).toEqual(['Hello Bob', 'Still there?']);
    expect((await b.post(`/conversations/${conv.id}/read`)).status).toBe(204);
    expect((await b.get('/conversations')).body.data[0].unreadCount).toBe(0);
    expect((await a.get('/conversations')).body.data[0].unreadCount).toBe(0); // own messages never unread
  });

  it('creates a single unread notification per conversation (no spam)', async () => {
    const { a, b, conv } = await pair();
    for (let i = 0; i < 3; i++) await a.post(`/conversations/${conv.id}/messages`, { body: `m${i}` });
    const notes = (await b.get('/notifications')).body.data.filter((n: { type: string }) => n.type === 'NEW_MESSAGE');
    expect(notes).toHaveLength(1);
  });

  it('rejects empty/whitespace/too long messages and makes retried sends idempotent', async () => {
    const { a, conv } = await pair();
    expect((await a.post(`/conversations/${conv.id}/messages`, { body: '   ' })).status).toBe(422);
    expect((await a.post(`/conversations/${conv.id}/messages`, { body: 'x'.repeat(2001) })).status).toBe(422);
    const m1 = await a.post(`/conversations/${conv.id}/messages`, { body: 'once', clientId: 'abc-1' });
    const m2 = await a.post(`/conversations/${conv.id}/messages`, { body: 'once', clientId: 'abc-1' });
    expect(m2.body.data.id).toBe(m1.body.data.id);
    expect(await prisma.message.count()).toBe(1);
  });

  it('paginates older messages with a cursor', async () => {
    const { a, conv } = await pair();
    for (let i = 1; i <= 5; i++) await a.post(`/conversations/${conv.id}/messages`, { body: `msg ${i}` });
    const p1 = await a.get(`/conversations/${conv.id}/messages?limit=2`);
    expect(p1.body.data.map((m: { body: string }) => m.body)).toEqual(['msg 4', 'msg 5']);
    expect(p1.body.meta.hasMore).toBe(true);
    const p2 = await a.get(`/conversations/${conv.id}/messages?limit=2&before=${p1.body.data[0].id}`);
    expect(p2.body.data.map((m: { body: string }) => m.body)).toEqual(['msg 2', 'msg 3']);
  });

  it('blocks non-participants from reading, sending, marking read or fetching', async () => {
    const { conv } = await pair();
    const eve = await makeUser('Msg Eve');
    expect((await eve.get(`/conversations/${conv.id}`)).status).toBe(404);
    expect((await eve.get(`/conversations/${conv.id}/messages`)).status).toBe(404);
    expect((await eve.post(`/conversations/${conv.id}/messages`, { body: 'psst' })).status).toBe(404);
    expect((await eve.post(`/conversations/${conv.id}/read`)).status).toBe(404);
    expect((await eve.get('/conversations')).body.data).toHaveLength(0);
    expect((await request(app).get(`${API}/conversations/${conv.id}/messages`)).status).toBe(401);
  });
});

describe('notifications', () => {
  it("cannot read or mark another user's notifications; mark-read is idempotent; read-all works", async () => {
    const o = await makeUser('Notif Owner');
    const b = await makeUser('Notif Borrower');
    const eve = await makeUser('Notif Eve');
    const item = await makeItem(o);
    await b.post('/requests', { itemId: item.id, startDate: futureDate(2), endDate: futureDate(3) });
    const list = await o.get('/notifications');
    const id = list.body.data[0].id;
    expect((await eve.post(`/notifications/${id}/read`)).status).toBe(404);
    expect((await eve.get('/notifications')).body.data).toHaveLength(0);
    expect((await o.post(`/notifications/${id}/read`)).status).toBe(200);
    expect((await o.post(`/notifications/${id}/read`)).status).toBe(200);
    expect((await o.get('/notifications/unread-count')).body.data.count).toBe(0);
    await b.post('/requests', { itemId: item.id, startDate: futureDate(8), endDate: futureDate(9) });
    expect((await o.get('/notifications/unread-count')).body.data.count).toBe(1);
    expect((await o.post('/notifications/read-all')).status).toBe(204);
    expect((await o.get('/notifications/unread-count')).body.data.count).toBe(0);
  });
  it('respects preferences for non-essential types but never for security', async () => {
    const o = await makeUser('Pref Owner');
    const b = await makeUser('Pref Borrower');
    await o.patch('/users/me/notification-preferences', { requestUpdates: false });
    const item = await makeItem(o);
    await b.post('/requests', { itemId: item.id, startDate: futureDate(2), endDate: futureDate(3) });
    expect((await o.get('/notifications')).body.data).toHaveLength(0);
    await o.post('/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Another-Pass-77', confirmPassword: 'Another-Pass-77' });
    expect((await o.get('/notifications')).body.data.some((n: { type: string }) => n.type === 'SECURITY')).toBe(true);
  });
});

describe('profiles', () => {
  it('lets users edit only their own profile and never exposes private fields', async () => {
    const a = await makeUser('Prof Alice');
    const b = await makeUser('Prof Bob');
    const upd = await a.patch('/users/me', { bio: 'Hello there', community: 'North Hall', city: 'Imphal', role: 'ADMIN', email: 'x@y.z' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.bio).toBe('Hello there');
    expect(upd.body.data.role).toBe('USER'); // mass-assignment attempt ignored
    expect(upd.body.data.email).toBe('prof.alice@example.com');
    const pub = await b.get(`/users/${a.id}`);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.body)).not.toMatch(/prof\.alice@example\.com|latitude|longitude|role|passwordHash/);
    expect((await b.patch(`/users/${a.id}`, { name: 'Hacked' })).status).toBe(404);
    expect((await b.get('/users/not-a-uuid')).status).toBe(404);
  });
});

describe('reports & moderation', () => {
  it('files reports, blocks duplicates and self-reports; admin-only moderation can hide a listing', async () => {
    const o = await makeUser('Rep Owner');
    const r = await makeUser('Rep Reporter');
    const item = await makeItem(o);
    expect((await o.post('/reports', { itemId: item.id, reason: 'OTHER' })).status).toBe(400); // own listing
    const rep = await r.post('/reports', { itemId: item.id, reason: 'SPAM_OR_MISLEADING', details: 'looks fake' });
    expect(rep.status).toBe(201);
    expect((await r.post('/reports', { itemId: item.id, reason: 'OTHER' })).status).toBe(409);
    expect((await r.post('/reports', { reason: 'OTHER' })).status).toBe(422);

    // non-admins are refused regardless of what the client claims
    expect((await r.get('/admin/reports')).status).toBe(403);
    expect((await r.post(`/admin/items/${item.id}/hide`)).status).toBe(403);

    await prisma.user.update({ where: { id: (await makeUser('Admin Ada')).id }, data: { role: 'ADMIN' } });
    const { login } = await import('./helpers');
    const admin = await login('admin.ada@example.com');
    const list = await admin.get('/admin/reports?status=OPEN');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    const reportId = list.body.data[0].id;
    expect((await admin.get(`/admin/reports/${reportId}`)).body.data.item.title).toBe('Cordless drill');
    const resolve = await admin.post(`/admin/reports/${reportId}/resolve`, { status: 'ACTIONED', hideItem: true, note: 'Confirmed' });
    expect(resolve.status).toBe(204);
    expect((await request(app).get(`${API}/items/${item.id}`)).status).toBe(404);
    expect((await o.get('/notifications')).body.data.some((n: { title: string }) => n.title === 'Your listing was hidden')).toBe(true);
    expect(await prisma.moderationAction.count()).toBeGreaterThanOrEqual(2);
    expect((await o.patch(`/items/${item.id}`, { status: 'AVAILABLE' })).status).toBe(409); // owner can't un-hide
    expect((await admin.post(`/admin/items/${item.id}/restore`)).status).toBe(204);
    expect((await request(app).get(`${API}/items/${item.id}`)).status).toBe(200);
  });
});

describe('account deletion', () => {
  it('requires password + confirmation, anonymises, archives listings and blocks login', async () => {
    const u = await makeUser('Del Dana');
    const item = await makeItem(u);
    expect((await u.del('/users/me', { password: 'wrong', confirm: 'DELETE' })).status).toBe(422);
    expect((await u.del('/users/me', { password: PASSWORD, confirm: 'nope' })).status).toBe(422);
    expect((await u.del('/users/me', { password: PASSWORD, confirm: 'DELETE' })).status).toBe(204);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.accountStatus).toBe('DELETED');
    expect(row.name).toBe('Deleted user');
    expect(row.email).not.toContain('del.dana');
    expect((await request(app).get(`${API}/items/${item.id}`)).status).toBe(404);
    expect((await request(app).post(`${API}/auth/login`).send({ email: 'del.dana@example.com', password: PASSWORD })).status).toBe(401);
    expect((await request(app).get(`${API}/users/${u.id}`)).status).toBe(404);
  });
});

describe('system endpoints', () => {
  it('health and ready respond without leaking configuration', async () => {
    expect((await request(app).get(`${API}/health`)).body.data.status).toBe('ok');
    const ready = await request(app).get(`${API}/ready`);
    expect(ready.status).toBe(200);
    expect(JSON.stringify(ready.body)).not.toMatch(/postgresql:\/\/|SECRET|password/i);
  });
  it('sets security headers and no x-powered-by', async () => {
    const res = await request(app).get(`${API}/health`);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('categories endpoint returns the defined list', async () => {
    expect((await request(app).get(`${API}/categories`)).body.data).toHaveLength(9);
  });
});
