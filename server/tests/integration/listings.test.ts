import { beforeEach, describe, expect, it } from 'vitest';
import { API, app, futureDate, itemPayload, makeItem, makeUser, png, prisma, request, resetDb } from './helpers';

beforeEach(resetDb);

describe('listing CRUD & permissions', () => {
  it('creates, edits and hides pickup details from the public', async () => {
    const owner = await makeUser('Olive Owner');
    const item = await makeItem(owner);
    const anon = await request(app).get(`${API}/items/${item.id}`);
    expect(anon.status).toBe(200);
    expect(anon.body.data.pickupInstructions).toBeNull();
    const own = await owner.get(`/items/${item.id}`);
    expect(own.body.data.pickupInstructions).toBe('Ring the bell twice.');
    expect(own.body.data.isOwner).toBe(true);
    const edit = await owner.patch(`/items/${item.id}`, { title: 'Updated drill' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.id).toBe(item.id);
    expect(edit.body.data.title).toBe('Updated drill');
  });

  it("never exposes exact coordinates, email, or the owner's role", async () => {
    const owner = await makeUser('Privacy Pete');
    const item = await makeItem(owner, { latitude: 24.8170123, longitude: 93.9360456 });
    const res = await request(app).get(`${API}/items/${item.id}`);
    const json = JSON.stringify(res.body);
    expect(json).not.toContain('24.8170123');
    expect(json).not.toContain('93.9360456');
    expect(json).not.toMatch(/privacy\.pete@example\.com|passwordHash|"role"/);
  });

  it("forbids editing, archiving or uploading to another user's listing (404, no leak)", async () => {
    const owner = await makeUser('Real Owner');
    const mallory = await makeUser('Mallory');
    const item = await makeItem(owner);
    expect((await mallory.patch(`/items/${item.id}`, { title: 'Hijacked' })).status).toBe(404);
    expect((await mallory.del(`/items/${item.id}`)).status).toBe(404);
    const up = await mallory.agent.post(`${API}/items/${item.id}/images`).set('X-CSRF-Token', mallory.csrf).attach('images', png, { filename: 'a.png', contentType: 'image/png' });
    expect(up.status).toBe(404);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).title).toBe('Cordless drill');
  });

  it('validates input on the server', async () => {
    const owner = await makeUser('Valid Val');
    const res = await owner.post('/items', itemPayload({ title: 'ab', description: 'short', category: 'weapons' }));
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['title', 'description', 'category']));
  });

  it('rejects malformed ids without hitting the database', async () => {
    expect((await request(app).get(`${API}/items/not-a-uuid`)).status).toBe(404);
  });
});

describe('image uploads', () => {
  it('accepts a real PNG and rejects a script renamed to .jpg', async () => {
    const owner = await makeUser('Img Ivy');
    const item = await makeItem(owner);
    const good = await owner.agent.post(`${API}/items/${item.id}/images`).set('X-CSRF-Token', owner.csrf).attach('images', png, { filename: 'a.png', contentType: 'image/png' });
    expect(good.status).toBe(201);
    expect(good.body.data.images).toHaveLength(1);
    const bad = await owner.agent.post(`${API}/items/${item.id}/images`).set('X-CSRF-Token', owner.csrf).attach('images', Buffer.from('<?php echo 1; ?>'.padEnd(64)), { filename: 'evil.jpg', contentType: 'image/jpeg' });
    expect(bad.status).toBe(415);
    const exe = await owner.agent.post(`${API}/items/${item.id}/images`).set('X-CSRF-Token', owner.csrf).attach('images', Buffer.from('MZ'.padEnd(64)), { filename: 'x.exe', contentType: 'application/x-msdownload' });
    expect(exe.status).toBe(415);
  });
  it('rejects oversized files and enforces the 5 image cap', async () => {
    const owner = await makeUser('Big Bob');
    const item = await makeItem(owner);
    const big = Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await owner.agent.post(`${API}/items/${item.id}/images`).set('X-CSRF-Token', owner.csrf).attach('images', big, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
    for (let i = 0; i < 5; i++) {
      expect((await owner.agent.post(`${API}/items/${item.id}/images`).set('X-CSRF-Token', owner.csrf).attach('images', png, { filename: `a${i}.png`, contentType: 'image/png' })).status).toBe(201);
    }
    const sixth = await owner.agent.post(`${API}/items/${item.id}/images`).set('X-CSRF-Token', owner.csrf).attach('images', png, { filename: 'six.png', contentType: 'image/png' });
    expect(sixth.status).toBe(422);
  });
  it('removes an image', async () => {
    const owner = await makeUser('Rem Rob');
    const item = await makeItem(owner);
    const up = await owner.agent.post(`${API}/items/${item.id}/images`).set('X-CSRF-Token', owner.csrf).attach('images', png, { filename: 'a.png', contentType: 'image/png' });
    const imageId = up.body.data.images[0].id;
    const del = await owner.del(`/items/${item.id}/images/${imageId}`);
    expect(del.status).toBe(200);
    expect(del.body.data.images).toHaveLength(0);
  });
});

describe('discovery', () => {
  it('searches, filters, paginates and only shows borrowable items', async () => {
    const o = await makeUser('Disc Dan');
    await makeItem(o, { title: 'Mountain bike', category: 'sports-fitness', condition: 'GOOD' });
    await makeItem(o, { title: 'Camping stove', category: 'outdoor-camping', condition: 'NEW' });
    const hidden = await makeItem(o, { title: 'Secret bike' });
    await o.patch(`/items/${hidden.id}`, { status: 'UNAVAILABLE' });
    const archived = await makeItem(o, { title: 'Old bike' });
    await o.del(`/items/${archived.id}`);

    const all = await request(app).get(`${API}/items`);
    expect(all.body.meta.total).toBe(2);
    const bikes = await request(app).get(`${API}/items?q=bike`);
    expect(bikes.body.data.map((i: { title: string }) => i.title)).toEqual(['Mountain bike']);
    expect((await request(app).get(`${API}/items?category=outdoor-camping`)).body.meta.total).toBe(1);
    expect((await request(app).get(`${API}/items?condition=NEW`)).body.meta.total).toBe(1);
    expect((await request(app).get(`${API}/items?q=outdoor`)).body.meta.total).toBe(1); // category label search
    const page = await request(app).get(`${API}/items?pageSize=1&page=2`);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta.totalPages).toBe(2);
    expect((await request(app).get(`${API}/items?pageSize=500`)).status).toBe(422);
  });
  it('is safe against SQL-ish and LIKE-wildcard input', async () => {
    const o = await makeUser('Inj Ian');
    await makeItem(o, { title: '100% cotton tent' });
    expect((await request(app).get(`${API}/items`).query({ q: "'; DROP TABLE \"Item\"; --" })).status).toBe(200);
    expect((await request(app).get(`${API}/items`).query({ q: '%' })).body.meta.total).toBe(1);
    expect((await request(app).get(`${API}/items`).query({ q: '_____zzz' })).body.meta.total).toBe(0);
    expect(await prisma.item.count()).toBe(1);
  });
  it('filters by availability window', async () => {
    const o = await makeUser('Avail Ann');
    const b = await makeUser('Avail Ben');
    const item = await makeItem(o);
    const r = await b.post('/requests', { itemId: item.id, startDate: futureDate(5), endDate: futureDate(8) });
    await o.post(`/requests/${r.body.data.id}/approve`);
    const clash = await request(app).get(`${API}/items`).query({ from: futureDate(6), to: futureDate(7) });
    expect(clash.body.meta.total).toBe(0);
    const free = await request(app).get(`${API}/items`).query({ from: futureDate(9), to: futureDate(10) });
    expect(free.body.meta.total).toBe(1);
    expect((await request(app).get(`${API}/items`).query({ from: futureDate(9) })).status).toBe(422);
  });
  it('supports distance filtering without inventing distances for items without coordinates', async () => {
    const o = await makeUser('Geo Gus');
    await makeItem(o, { title: 'Near thing', latitude: 24.817, longitude: 93.936 });
    await makeItem(o, { title: 'Far thing', latitude: 28.6, longitude: 77.2 });
    await makeItem(o, { title: 'No coords' });
    const res = await request(app).get(`${API}/items`).query({ lat: 24.8, lng: 93.9, radiusKm: 10, sort: 'distance' });
    expect(res.body.data.map((i: { title: string }) => i.title)).toEqual(['Near thing']);
    expect(res.body.data[0].distanceKm).toBeGreaterThan(0);
    const sorted = await request(app).get(`${API}/items`).query({ lat: 24.8, lng: 93.9, sort: 'distance' });
    const noCoords = sorted.body.data.find((i: { title: string }) => i.title === 'No coords');
    expect(noCoords.distanceKm).toBeNull();
    expect(sorted.body.data[0].title).toBe('Near thing');
  });
});

describe('favourites', () => {
  it('adds, is idempotent, lists, removes, and rejects missing items', async () => {
    const o = await makeUser('Fav Owner');
    const u = await makeUser('Fav Fan');
    const item = await makeItem(o);
    expect((await u.post(`/favorites/${item.id}`)).status).toBe(201);
    expect((await u.post(`/favorites/${item.id}`)).status).toBe(201);
    expect(await prisma.favorite.count()).toBe(1);
    expect((await u.get('/favorites')).body.data).toHaveLength(1);
    expect((await u.get(`/items/${item.id}`)).body.data.favorited).toBe(true);
    expect((await u.post('/favorites/11111111-1111-4111-8111-111111111111')).status).toBe(404);
    expect((await u.del(`/favorites/${item.id}`)).status).toBe(204);
    expect((await u.get('/favorites')).body.data).toHaveLength(0);
  });
});

describe('archive rules', () => {
  it('blocks archiving with an approved borrowing; archives otherwise and allows reactivation', async () => {
    const o = await makeUser('Arch Owner');
    const b = await makeUser('Arch Borrower');
    const item = await makeItem(o);
    const r = await b.post('/requests', { itemId: item.id, startDate: futureDate(2), endDate: futureDate(3) });
    await o.post(`/requests/${r.body.data.id}/approve`);
    const blocked = await o.del(`/items/${item.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('INVALID_STATE');

    const free = await makeItem(o, { title: 'Free item' });
    expect((await o.del(`/items/${free.id}`)).status).toBe(204);
    expect((await request(app).get(`${API}/items/${free.id}`)).status).toBe(404);
    expect((await o.get(`/items/${free.id}`)).status).toBe(200);
    expect((await o.post(`/items/${free.id}/reactivate`)).status).toBe(200);
    expect((await request(app).get(`${API}/items/${free.id}`)).status).toBe(200);
  });
});
