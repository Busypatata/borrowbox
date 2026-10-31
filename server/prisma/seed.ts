/**
 * Deterministic, idempotent DEVELOPMENT seed. Refuses to run in production.
 * Dev accounts (password for all: see SEED_PASSWORD below) are documented in README.
 */
import { CATEGORIES } from '@borrowbox/shared';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { conversationKey } from '../src/utils/conversationKey';
import { hashPassword } from '../src/utils/crypto';

if (env.isProd) {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const SEED_PASSWORD = 'Password123!';
const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = (n: number) => id('a0000000', n);
const I = (n: number) => id('b0000000', n);
const R = (n: number) => id('c0000000', n);
const T = (n: number) => id('d0000000', n);
const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
};

// Royalty-free Unsplash photos (hotlinked, development only).
const img = (photo: string) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=70`;

async function main() {
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { label: c.label, sortOrder: i },
      create: { slug: c.slug, label: c.label, sortOrder: i },
    });
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const adminHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe-Admin-123!');
  const verified = new Date();
  const base = { city: 'Imphal', community: 'Imphal West', emailVerifiedAt: verified };
  const users = [
    { n: 1, name: 'Aditi Singh', email: 'aditi@borrowbox.test', lat: 24.817, lng: 93.936, bio: "I'm a CS student who loves reading, photography and sharing useful things with my community." },
    { n: 2, name: 'Sarah Khan', email: 'sarah@borrowbox.test', lat: 24.808, lng: 93.944, bio: 'Weekend photographer and camper.' },
    { n: 3, name: 'Rahul Mehta', email: 'rahul@borrowbox.test', lat: 24.822, lng: 93.929, bio: 'Home cook and board-game collector.' },
    { n: 4, name: 'Priya Sharma', email: 'priya@borrowbox.test', lat: 24.812, lng: 93.951, bio: 'Hiker. Happy to lend outdoor gear.' },
    { n: 5, name: 'Unverified Uma', email: 'uma@borrowbox.test', lat: null, lng: null, bio: null, unverified: true },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: U(u.n) },
      update: {},
      create: {
        id: U(u.n), name: u.name, email: u.email, passwordHash, bio: u.bio, ...base,
        emailVerifiedAt: u.unverified ? null : verified,
        latitude: u.lat, longitude: u.lng,
        notificationPref: { create: {} },
      },
    });
  }
  await prisma.user.upsert({
    where: { id: U(99) },
    update: {},
    create: { id: U(99), name: 'BorrowBox Admin', email: 'admin@borrowbox.test', passwordHash: adminHash, role: 'ADMIN', emailVerifiedAt: verified, notificationPref: { create: {} } },
  });

  type Seed = { n: number; owner: number; title: string; cat: string; cond: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR'; desc: string; photo: string; lat: number; lng: number; pickup: string };
  const items: Seed[] = [
    { n: 1, owner: 2, title: 'Canon EOS 200D', cat: 'electronics', cond: 'LIKE_NEW', desc: 'Barely used DSLR. Comes with charger, extra battery and camera bag. Perfect for beginners or travel photography.', photo: 'photo-1516035069371-29a1b244cc32', lat: 24.808, lng: 93.944, pickup: 'Pickup at the community centre lobby, weekdays after 6 PM.' },
    { n: 2, owner: 4, title: 'Camping Tent (3-person)', cat: 'outdoor-camping', cond: 'GOOD', desc: 'Waterproof three-person tent with rainfly and stakes. Sets up in ten minutes; packs into a carry bag.', photo: 'photo-1504280390367-361c6d9f38f4', lat: 24.812, lng: 93.951, pickup: 'Collect from my porch, text me first.' },
    { n: 3, owner: 3, title: 'Board Game Set (Catan + Ticket to Ride)', cat: 'games-entertainment', cond: 'LIKE_NEW', desc: 'Two classic board games, all pieces counted and present. Great for a weekend game night with friends.', photo: 'photo-1610890716171-6b1bb98ffd09', lat: 24.822, lng: 93.929, pickup: 'Meet at the campus gate cafe.' },
    { n: 4, owner: 3, title: 'Air Fryer', cat: 'kitchen', cond: 'GOOD', desc: '4-litre air fryer with basket and recipe booklet. Cleaned after every use, works perfectly.', photo: 'photo-1626162764068-7c3dd9a4a5b1', lat: 24.822, lng: 93.929, pickup: 'Evenings, ground floor flat.' },
    { n: 5, owner: 1, title: 'Acoustic Guitar', cat: 'games-entertainment', cond: 'GOOD', desc: 'Full-size acoustic guitar with a soft case and spare strings. Learning? Borrow it for a couple of weeks.', photo: 'photo-1510915361894-db8b60106cb1', lat: 24.817, lng: 93.936, pickup: 'Hostel common room.' },
    { n: 6, owner: 4, title: 'Hiking Backpack 50L', cat: 'outdoor-camping', cond: 'GOOD', desc: 'Comfortable 50-litre trekking backpack with rain cover and adjustable straps.', photo: 'photo-1553062407-98eeb64c6a62', lat: 24.812, lng: 93.951, pickup: 'Flexible — message me.' },
    { n: 7, owner: 2, title: 'Cordless Power Drill', cat: 'tools-diy', cond: 'GOOD', desc: 'Cordless drill with two batteries, charger and a basic bit set. Ideal for furniture assembly and wall mounting.', photo: 'photo-1504148455328-c376907d081c', lat: 24.808, lng: 93.944, pickup: 'Community centre lobby.' },
    { n: 8, owner: 1, title: 'Data Structures & Algorithms Textbooks', cat: 'books-study', cond: 'FAIR', desc: 'Set of three DSA and OS textbooks with light annotations. Perfect for exam season.', photo: 'photo-1544716278-ca5e3f4abd8c', lat: 24.817, lng: 93.936, pickup: 'Library steps at 5 PM.' },
    { n: 9, owner: 3, title: 'Yoga Mat & Blocks', cat: 'sports-fitness', cond: 'LIKE_NEW', desc: 'Non-slip yoga mat with two foam blocks and a strap.', photo: 'photo-1601925260368-ae2f83cf8b7f', lat: 24.822, lng: 93.929, pickup: 'Front desk of my building.' },
  ];
  for (const it of items) {
    await prisma.item.upsert({
      where: { id: I(it.n) },
      update: {},
      create: {
        id: I(it.n), ownerId: U(it.owner), title: it.title, description: it.desc, categorySlug: it.cat, condition: it.cond,
        community: 'Imphal West', city: 'Imphal', latitude: it.lat, longitude: it.lng, pickupInstructions: it.pickup,
        images: { create: [{ id: id('e0000000', it.n), url: img(it.photo), storageKey: `seed:${it.n}`, altText: it.title, sortOrder: 0 }] },
      },
    });
  }

  // Requests / transactions (all consistent with the state machine and booking rules).
  const reqs = [
    { n: 1, item: 7, borrower: 1, start: day(-20), end: day(-15), status: 'COMPLETED' as const, tx: { n: 1, status: 'COMPLETED' as const } },
    { n: 2, item: 1, borrower: 1, start: day(3), end: day(6), status: 'APPROVED' as const, tx: { n: 2, status: 'AWAITING_HANDOVER' as const } },
    { n: 3, item: 2, borrower: 3, start: day(-2), end: day(3), status: 'APPROVED' as const, tx: { n: 3, status: 'BORROWED' as const } },
    { n: 4, item: 5, borrower: 2, start: day(5), end: day(8), status: 'PENDING' as const },
    { n: 5, item: 5, borrower: 4, start: day(10), end: day(12), status: 'PENDING' as const },
    { n: 6, item: 3, borrower: 1, start: day(7), end: day(9), status: 'DECLINED' as const },
  ];
  for (const r of reqs) {
    const item = items.find((i) => i.n === r.item)!;
    await prisma.borrowRequest.upsert({
      where: { id: R(r.n) },
      update: {},
      create: {
        id: R(r.n), itemId: I(r.item), borrowerId: U(r.borrower), ownerId: U(item.owner),
        startDate: r.start, endDate: r.end, status: r.status, message: 'Hi! Would love to borrow this.',
        decisionAt: r.status === 'PENDING' ? null : new Date(),
        cancellationReason: r.status === 'DECLINED' ? 'Already promised to a friend.' : null,
      },
    });
    if (r.tx) {
      const done = r.tx.status === 'COMPLETED';
      await prisma.transaction.upsert({
        where: { id: T(r.tx.n) },
        update: {},
        create: {
          id: T(r.tx.n), requestId: R(r.n), status: r.tx.status,
          handoverConfirmedAt: r.tx.status === 'AWAITING_HANDOVER' ? null : new Date(),
          returnConfirmedAt: done ? new Date() : null, completedAt: done ? new Date() : null,
        },
      });
    }
  }

  await prisma.review.upsert({
    where: { transactionId_reviewerId: { transactionId: T(1), reviewerId: U(2) } },
    update: {},
    create: { id: id('f0000000', 1), transactionId: T(1), reviewerId: U(2), reviewedUserId: U(1), rating: 5, comment: 'Very polite and easy to communicate with. The item was in great condition!' },
  });
  await prisma.review.upsert({
    where: { transactionId_reviewerId: { transactionId: T(1), reviewerId: U(1) } },
    update: {},
    create: { id: id('f0000000', 2), transactionId: T(1), reviewerId: U(1), reviewedUserId: U(2), rating: 5, comment: 'Great experience! Would definitely borrow again.' },
  });

  for (const [u, n] of [[1, 2], [1, 6], [3, 1]] as const) {
    await prisma.favorite.upsert({
      where: { userId_itemId: { userId: U(u), itemId: I(n) } },
      update: {},
      create: { userId: U(u), itemId: I(n) },
    });
  }

  // Conversation + messages (aditi <-> sarah about the camera).
  const key = conversationKey(U(1), U(2), I(1));
  const [a, b] = [U(1), U(2)].sort() as [string, string];
  const past = new Date(Date.now() - 3 * 3_600_000);
  const conv = await prisma.conversation.upsert({
    where: { key },
    update: {},
    create: { key, userAId: a, userBId: b, itemId: I(1), requestId: R(2), aLastReadAt: past, bLastReadAt: new Date(), updatedAt: new Date() },
  });
  const msgs = [
    { n: 1, from: 1, body: "Hi! I'm interested in borrowing your camera. Is it still available?" },
    { n: 2, from: 2, body: "Yes, it is! It's available for the dates you mentioned." },
    { n: 3, from: 1, body: 'Great! Can you share the pickup location details?' },
    { n: 4, from: 2, body: "Sure, I'll send the location after approval. Let me know if you have any questions!" },
  ];
  for (const m of msgs) {
    await prisma.message.upsert({
      where: { id: id('90000000', m.n) },
      update: {},
      create: { id: id('90000000', m.n), conversationId: conv.id, senderId: U(m.from), body: m.body, createdAt: new Date(Date.now() - (5 - m.n) * 60_000 * 10) },
    });
  }

  const notes = [
    { n: 1, to: 2, type: 'REQUEST_RECEIVED' as const, title: 'New borrowing request', body: 'Aditi Singh wants to borrow "Canon EOS 200D".', entity: ['request', R(2)] },
    { n: 2, to: 1, type: 'REQUEST_APPROVED' as const, title: 'Request approved', body: 'Your request to borrow "Canon EOS 200D" was approved.', entity: ['request', R(2)] },
    { n: 3, to: 1, type: 'REQUEST_RECEIVED' as const, title: 'New borrowing request', body: 'Sarah Khan wants to borrow "Acoustic Guitar".', entity: ['request', R(4)] },
  ];
  for (const nt of notes) {
    await prisma.notification.upsert({
      where: { dedupeKey: `seed:${nt.n}` },
      update: {},
      create: { id: id('80000000', nt.n), recipientId: U(nt.to), type: nt.type, title: nt.title, body: nt.body, entityType: nt.entity[0], entityId: nt.entity[1], dedupeKey: `seed:${nt.n}` },
    });
  }

  console.log('Seeded. Dev logins (password "%s"): aditi@, sarah@, rahul@, priya@ borrowbox.test; admin@borrowbox.test uses SEED_ADMIN_PASSWORD.', SEED_PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
