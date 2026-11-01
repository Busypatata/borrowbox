import { beforeEach, describe, expect, it } from 'vitest';
import { cleanupDemoData } from '../../src/maintenance/cleanupDemo';
import { futureDate, makeItem, makeUser, prisma, resetDb } from './helpers';

const U = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const I = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function seedDemo() {
  const mk = (n: number, name: string, role: 'USER' | 'ADMIN' = 'USER') =>
    prisma.user.create({ data: { id: U(n), name, email: `${name.toLowerCase().replace(/\W/g, '')}@borrowbox.test`, passwordHash: 'x', role, emailVerifiedAt: new Date(), notificationPref: { create: {} } } });
  await mk(1, 'Demo One'); await mk(2, 'Demo Two'); await mk(99, 'Demo Admin', 'ADMIN');
  await prisma.item.create({ data: { id: I(1), ownerId: U(2), title: 'Demo Camera', description: 'd'.repeat(30), categorySlug: 'electronics', condition: 'GOOD', community: 'c', city: 'c' } });
  await prisma.borrowRequest.create({ data: { id: R(1), itemId: I(1), borrowerId: U(1), ownerId: U(2), startDate: new Date(futureDate(3)), endDate: new Date(futureDate(4)) } });
  const conv = await prisma.conversation.create({ data: { key: 'demo-key', userAId: U(1), userBId: U(2), itemId: I(1) } });
  await prisma.message.create({ data: { conversationId: conv.id, senderId: U(1), body: 'hello demo' } });
  await prisma.notification.create({ data: { recipientId: U(2), type: 'REQUEST_RECEIVED', title: 't', body: 'b', entityType: 'request', entityId: R(1) } });
}
const counts = async () => ({
  users: await prisma.user.count(), items: await prisma.item.count(), requests: await prisma.borrowRequest.count(),
  messages: await prisma.message.count(), notifications: await prisma.notification.count(), conversations: await prisma.conversation.count(),
});

describe('cleanupDemoData', () => {
  beforeEach(resetDb);

  it('dry run reports but changes nothing', async () => {
    await seedDemo();
    const before = await counts();
    const r = await cleanupDemoData(prisma);
    expect(r.applied).toBe(false);
    expect(r.counts).toMatchObject({ members: 2, listings: 1, requests: 1, messages: 1 });
    expect(await counts()).toEqual(before);
  });

  it('removes only demo records and leaves real users, listings, requests and conversations intact', async () => {
    await seedDemo();
    const owner = await makeUser('Real Owner');
    const borrower = await makeUser('Real Borrower');
    const item = await makeItem(owner);
    const req = await borrower.post('/requests', { itemId: item.id, startDate: futureDate(2), endDate: futureDate(3), message: 'hi' });
    expect(req.status).toBe(201);
    const conv = await borrower.post('/conversations', { recipientId: owner.id, itemId: item.id, body: 'real message' });
    expect(conv.status).toBeLessThan(300);
    const realBefore = {
      items: await prisma.item.count({ where: { ownerId: owner.id } }),
      requests: await prisma.borrowRequest.count({ where: { itemId: item.id } }),
      notifications: await prisma.notification.count({ where: { recipientId: { in: [owner.id, borrower.id] } } }),
      messages: await prisma.message.count({ where: { body: 'real message' } }),
    };

    const r = await cleanupDemoData(prisma, { apply: true });
    expect(r.applied).toBe(true);
    expect(r.blocked).toBeNull();

    expect(await prisma.user.count({ where: { email: { endsWith: '@borrowbox.test' }, role: 'USER' } })).toBe(0);
    expect(await prisma.item.count({ where: { id: I(1) } })).toBe(0);
    expect(await prisma.borrowRequest.count({ where: { id: R(1) } })).toBe(0);
    expect(await prisma.message.count({ where: { body: 'hello demo' } })).toBe(0);
    expect(await prisma.user.count({ where: { id: U(99) } })).toBe(1); // admin kept by default

    expect(await prisma.user.count({ where: { id: { in: [owner.id, borrower.id] } } })).toBe(2);
    expect({
      items: await prisma.item.count({ where: { ownerId: owner.id } }),
      requests: await prisma.borrowRequest.count({ where: { itemId: item.id } }),
      notifications: await prisma.notification.count({ where: { recipientId: { in: [owner.id, borrower.id] } } }),
      messages: await prisma.message.count({ where: { body: 'real message' } }),
    }).toEqual(realBefore);
  });

  it('is idempotent and can remove the demo admin on request', async () => {
    await seedDemo();
    await cleanupDemoData(prisma, { apply: true, removeAdmin: true });
    expect(await counts()).toMatchObject({ users: 0, items: 0, requests: 0, messages: 0, notifications: 0, conversations: 0 });
    const again = await cleanupDemoData(prisma, { apply: true, removeAdmin: true });
    expect(again.applied).toBe(true);
  });

  it('refuses to delete a real member\'s request on a demo listing unless explicitly told to', async () => {
    await seedDemo();
    const real = await makeUser('Real Person');
    await prisma.borrowRequest.create({ data: { itemId: I(1), borrowerId: real.id, ownerId: U(2), startDate: new Date(futureDate(10)), endDate: new Date(futureDate(11)) } });
    const blocked = await cleanupDemoData(prisma, { apply: true });
    expect(blocked.blocked).toMatch(/real members/i);
    expect(blocked.applied).toBe(false);
    expect(await prisma.item.count({ where: { id: I(1) } })).toBe(1);
    const forced = await cleanupDemoData(prisma, { apply: true, includeRealDependents: true });
    expect(forced.applied).toBe(true);
    expect(await prisma.user.count({ where: { id: real.id } })).toBe(1); // the real account itself is never touched
  });
});
