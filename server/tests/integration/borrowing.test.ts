import { beforeEach, describe, expect, it } from 'vitest';
import { futureDate, makeItem, makeUser, prisma, resetDb, type TestUser } from './helpers';

beforeEach(resetDb);

async function setup() {
  const owner = await makeUser('Owner Olga');
  const borrower = await makeUser('Borrower Bart');
  const item = await makeItem(owner);
  return { owner, borrower, item };
}
const ask = (u: TestUser, itemId: string, s = 3, e = 5) =>
  u.post('/requests', { itemId, startDate: futureDate(s), endDate: futureDate(e), message: 'Please?' });

describe('request creation rules', () => {
  it('creates a pending request and notifies the owner exactly once', async () => {
    const { owner, borrower, item } = await setup();
    const res = await ask(borrower, item.id);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    const notes = await owner.get('/notifications');
    expect(notes.body.data.filter((n: { type: string }) => n.type === 'REQUEST_RECEIVED')).toHaveLength(1);
    expect(notes.body.meta.unread).toBe(1);
  });
  it('rejects own item, unverified users, bad dates, duplicates, unknown items', async () => {
    const { owner, borrower, item } = await setup();
    expect((await ask(owner, item.id)).status).toBe(403);
    const unverified = await makeUser('Uma Unverified', { verify: false });
    expect((await ask(unverified, item.id)).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await borrower.post('/requests', { itemId: item.id, startDate: futureDate(-3), endDate: futureDate(2) })).status).toBe(422);
    expect((await borrower.post('/requests', { itemId: item.id, startDate: futureDate(5), endDate: futureDate(3) })).status).toBe(422);
    expect((await borrower.post('/requests', { itemId: item.id, startDate: futureDate(2), endDate: futureDate(90) })).status).toBe(422);
    expect((await ask(borrower, item.id)).status).toBe(201);
    const dup = await ask(borrower, item.id, 4, 6);
    expect(dup.status).toBe(409);
    expect((await ask(borrower, '11111111-1111-4111-8111-111111111111')).status).toBe(404);
  });
  it('double-submit of the same request yields one request', async () => {
    const { borrower, item } = await setup();
    const [a, b] = await Promise.all([ask(borrower, item.id), ask(borrower, item.id)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.borrowRequest.count()).toBe(1);
  });
  it('rejects requests for unavailable or archived items', async () => {
    const { owner, borrower, item } = await setup();
    await owner.patch(`/items/${item.id}`, { status: 'UNAVAILABLE' });
    expect((await ask(borrower, item.id)).status).toBe(409);
    await owner.patch(`/items/${item.id}`, { status: 'AVAILABLE' });
    await owner.del(`/items/${item.id}`);
    expect((await ask(borrower, item.id)).status).toBe(404);
  });
});

describe('decisions & authorization', () => {
  it('only the owner can approve/decline; only the borrower can cancel', async () => {
    const { owner, borrower, item } = await setup();
    const stranger = await makeUser('Stranger Sam');
    const id = (await ask(borrower, item.id)).body.data.id;
    expect((await borrower.post(`/requests/${id}/approve`)).status).toBe(403); // own request
    expect((await stranger.post(`/requests/${id}/approve`)).status).toBe(404);
    expect((await stranger.get(`/requests/${id}`)).status).toBe(404);
    expect((await owner.post(`/requests/${id}/cancel`)).status).toBe(403);
    expect((await stranger.post(`/requests/${id}/decline`)).status).toBe(404);
    expect((await owner.post(`/requests/${id}/approve`)).status).toBe(200);
  });
  it('decline records reason; terminal states cannot be reopened', async () => {
    const { owner, borrower, item } = await setup();
    const id = (await ask(borrower, item.id)).body.data.id;
    const dec = await owner.post(`/requests/${id}/decline`, { reason: 'Away that week' });
    expect(dec.body.data.status).toBe('DECLINED');
    expect(dec.body.data.cancellationReason).toBe('Away that week');
    expect((await owner.post(`/requests/${id}/approve`)).status).toBe(409);
    expect((await borrower.post(`/requests/${id}/cancel`)).status).toBe(409);
    const notes = await borrower.get('/notifications');
    expect(notes.body.data.some((n: { type: string }) => n.type === 'REQUEST_DECLINED')).toBe(true);
  });
  it('borrower can cancel pending; cancelled cannot then be approved; approved cannot be cancelled', async () => {
    const { owner, borrower, item } = await setup();
    const id = (await ask(borrower, item.id)).body.data.id;
    expect((await borrower.post(`/requests/${id}/cancel`)).body.data.status).toBe('CANCELLED');
    expect((await owner.post(`/requests/${id}/approve`)).status).toBe(409);
    const id2 = (await ask(borrower, item.id, 10, 12)).body.data.id;
    await owner.post(`/requests/${id2}/approve`);
    const c = await borrower.post(`/requests/${id2}/cancel`);
    expect(c.status).toBe(409);
    expect((await owner.get('/notifications')).body.data.some((n: { type: string }) => n.type === 'REQUEST_CANCELLED')).toBe(true);
  });
  it('repeated approve/decline retries never duplicate notifications', async () => {
    const { owner, borrower, item } = await setup();
    const id = (await ask(borrower, item.id)).body.data.id;
    await owner.post(`/requests/${id}/approve`);
    await owner.post(`/requests/${id}/approve`);
    const n = (await borrower.get('/notifications')).body.data.filter((x: { type: string }) => x.type === 'REQUEST_APPROVED');
    expect(n).toHaveLength(1);
  });
});

describe('reservation conflicts', () => {
  it('approval auto-declines competing overlapping requests and blocks overlapping new ones', async () => {
    const { owner, borrower, item } = await setup();
    const rival = await makeUser('Rival Rex');
    const a = (await ask(borrower, item.id, 3, 6)).body.data.id;
    const b = (await ask(rival, item.id, 5, 8)).body.data.id;
    expect((await owner.post(`/requests/${a}/approve`)).status).toBe(200);
    expect((await owner.get(`/requests/${b}`)).body.data.status).toBe('DECLINED');
    expect((await owner.post(`/requests/${b}/approve`)).status).toBe(409);
    const late = await ask(rival, item.id, 4, 5);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('BOOKING_CONFLICT');
    expect((await ask(rival, item.id, 7, 9)).status).toBe(201); // adjacent/non-overlapping still fine
  });
  it('two simultaneous approvals of overlapping requests: exactly one wins', async () => {
    const { owner, item } = await setup();
    const users = await Promise.all(['Racer One', 'Racer Two', 'Racer Three'].map((n) => makeUser(n)));
    const ids: string[] = [];
    // Insert pending overlapping requests directly (the API would auto-decline none, but this removes ordering noise).
    for (const [i, u] of users.entries()) {
      const r = await prisma.borrowRequest.create({
        data: { itemId: item.id, borrowerId: u.id, ownerId: owner.id, startDate: new Date(`${futureDate(10 + i)}T00:00:00Z`), endDate: new Date(`${futureDate(14 + i)}T00:00:00Z`) },
      });
      ids.push(r.id);
    }
    const results = await Promise.all(ids.map((id) => owner.post(`/requests/${id}/approve`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409).length).toBe(2);
    expect(await prisma.borrowRequest.count({ where: { status: 'APPROVED' } })).toBe(1);
  });
  it('the database itself rejects overlapping approved bookings (even bypassing the service)', async () => {
    const { owner, borrower, item } = await setup();
    const rival = await makeUser('Raw Rival');
    const mk = (borrowerId: string, s: number, e: number, status: 'APPROVED') =>
      prisma.borrowRequest.create({ data: { itemId: item.id, borrowerId, ownerId: owner.id, startDate: new Date(`${futureDate(s)}T00:00:00Z`), endDate: new Date(`${futureDate(e)}T00:00:00Z`), status } });
    await mk(borrower.id, 20, 25, 'APPROVED');
    await expect(mk(rival.id, 25, 27, 'APPROVED')).rejects.toThrow();
    await expect(mk(rival.id, 26, 27, 'APPROVED')).resolves.toBeTruthy();
  });
});

describe('handover → return → completion → reviews', () => {
  async function approved() {
    const ctx = await setup();
    const id = (await ask(ctx.borrower, ctx.item.id)).body.data.id;
    const approvedReq = await ctx.owner.post(`/requests/${id}/approve`);
    const txId = approvedReq.body.data.transaction.id as string;
    return { ...ctx, reqId: id as string, txId };
  }

  it('enforces roles and order of transitions', async () => {
    const { owner, borrower, txId } = await approved();
    const stranger = await makeUser('Tx Stranger');
    expect((await borrower.post(`/transactions/${txId}/confirm-handover`)).status).toBe(403);
    expect((await stranger.post(`/transactions/${txId}/confirm-handover`)).status).toBe(404);
    expect((await owner.post(`/transactions/${txId}/confirm-return`)).status).toBe(409); // out of order
    expect((await borrower.post(`/transactions/${txId}/request-return`)).status).toBe(409); // out of order
    expect((await owner.post(`/transactions/${txId}/confirm-handover`)).body.data.status).toBe('BORROWED');
    expect((await owner.post(`/transactions/${txId}/confirm-handover`)).status).toBe(409); // twice
    expect((await owner.post(`/transactions/${txId}/request-return`)).status).toBe(403);
    expect((await borrower.post(`/transactions/${txId}/request-return`)).body.data.status).toBe('RETURN_REQUESTED');
    expect((await borrower.post(`/transactions/${txId}/confirm-return`)).status).toBe(403);
  });

  it('full lifecycle completes the request, returns pickup details only to participants, and allows two-way reviews once', async () => {
    const { owner, borrower, item, reqId, txId } = await approved();
    const pre = await borrower.get(`/requests/${reqId}`);
    expect(pre.body.data.transaction.pickupInstructions).toBe('Ring the bell twice.');
    expect((await borrower.get(`/items/${item.id}`)).body.data.pickupInstructions).toBe('Ring the bell twice.');

    // reviews are not allowed before completion
    expect((await borrower.post(`/transactions/${txId}/reviews`, { rating: 5 })).status).toBe(409);

    await owner.post(`/transactions/${txId}/confirm-handover`);
    await borrower.post(`/transactions/${txId}/request-return`);
    const done = await owner.post(`/transactions/${txId}/confirm-return`);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.completedAt).toBeTruthy();
    expect((await owner.post(`/transactions/${txId}/confirm-return`)).status).toBe(409); // twice
    expect((await owner.get(`/requests/${reqId}`)).body.data.status).toBe('COMPLETED');

    const r1 = await borrower.post(`/transactions/${txId}/reviews`, { rating: 5, comment: 'Great owner' });
    expect(r1.status).toBe(201);
    expect((await borrower.post(`/transactions/${txId}/reviews`, { rating: 1 })).status).toBe(409); // duplicate
    expect((await owner.post(`/transactions/${txId}/reviews`, { rating: 4 })).status).toBe(201);
    expect((await borrower.post(`/transactions/${txId}/reviews`, { rating: 9 })).status).toBe(422);
    const stranger = await makeUser('Review Stranger');
    expect((await stranger.post(`/transactions/${txId}/reviews`, { rating: 5 })).status).toBe(404);

    const profile = await owner.get(`/users/${owner.id}`);
    expect(profile.body.data.ratingAverage).toBe(5);
    expect(profile.body.data.ratingCount).toBe(1);
    const reviews = await owner.get(`/users/${owner.id}/reviews`);
    expect(reviews.body.data[0].reviewer.name).toBe('Borrower Bart');
    const noReviews = await owner.get(`/users/${borrower.id}`);
    expect(noReviews.body.data.ratingAverage).toBe(4);
    const fresh = await makeUser('Fresh Face');
    expect((await fresh.get(`/users/${fresh.id}`)).body.data.ratingAverage).toBeNull(); // no fabricated rating
    expect((await prisma.review.count())).toBe(2);
  });

  it('a borrower cannot reach pickup details before approval', async () => {
    const { borrower, item } = await setup();
    await ask(borrower, item.id);
    expect((await borrower.get(`/items/${item.id}`)).body.data.pickupInstructions).toBeNull();
  });

  it('produces the right notifications through the lifecycle', async () => {
    const { owner, borrower, txId } = await approved();
    await owner.post(`/transactions/${txId}/confirm-handover`);
    await borrower.post(`/transactions/${txId}/request-return`);
    await owner.post(`/transactions/${txId}/confirm-return`);
    const bTypes = (await borrower.get('/notifications')).body.data.map((n: { type: string }) => n.type);
    const oTypes = (await owner.get('/notifications')).body.data.map((n: { type: string }) => n.type);
    expect(bTypes).toEqual(expect.arrayContaining(['REQUEST_APPROVED', 'HANDOVER_CONFIRMED', 'RETURN_CONFIRMED']));
    expect(oTypes).toEqual(expect.arrayContaining(['REQUEST_RECEIVED', 'RETURN_REQUESTED']));
  });

  it('account deletion is blocked while a borrowing is in progress', async () => {
    const { borrower } = await approved();
    const res = await borrower.del('/users/me', { password: 'Sup3rSecret!pass', confirm: 'DELETE' });
    expect(res.status).toBe(409);
  });
});
