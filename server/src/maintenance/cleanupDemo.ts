/**
 * Removes the demonstration records inserted by the OLD development seed — and nothing else.
 *
 * A record is "demo" only if it matches the seed's fixed identifiers:
 *   - members:   id like 'a0000000-0000-4000-8000-%'  AND  email ending '@borrowbox.test'
 *   - listings:  id like 'b0000000-0000-4000-8000-%'  OR owned by a demo member
 *   - requests / transactions: ids 'c0000000-…' / 'd0000000-…' OR attached to demo members/listings
 * Real accounts get random v4 UUIDs, so they can never match these patterns.
 *
 * Safety: dry-run by default; refuses to proceed if real members' records depend on demo ones
 * (e.g. a real user requested a demo item) unless includeRealDependents is set; the demo admin
 * account is kept unless removeAdmin is set; everything runs in ONE database transaction.
 */
import { Prisma, type PrismaClient } from '@prisma/client';

export interface CleanupOptions { apply?: boolean; removeAdmin?: boolean; includeRealDependents?: boolean }
export interface CleanupReport {
  applied: boolean;
  blocked: string | null;
  demoUsers: string[];
  keptAdmin: string | null;
  counts: Record<string, number>;
  realDependents: Record<string, number>;
}

const U = 'a0000000-0000-4000-8000-%';
const I = 'b0000000-0000-4000-8000-%';
const R = 'c0000000-0000-4000-8000-%';
const T = 'd0000000-0000-4000-8000-%';

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

export async function cleanupDemoData(prisma: PrismaClient, opts: CleanupOptions = {}): Promise<CleanupReport> {
  const q = <T = { id: string }>(sql: Prisma.Sql) => prisma.$queryRaw<T[]>(sql);

  const allDemo = await q<{ id: string; email: string; role: string }>(
    Prisma.sql`SELECT id::text, email, role::text FROM "User" WHERE id::text LIKE ${U} AND email LIKE '%@borrowbox.test'`,
  );
  const keepAdmin = !opts.removeAdmin;
  const admins = allDemo.filter((u) => u.role === 'ADMIN');
  const demoUsers = allDemo.filter((u) => !(keepAdmin && u.role === 'ADMIN'));
  const userIds = demoUsers.map((u) => u.id);

  const report: CleanupReport = {
    applied: false, blocked: null, demoUsers: demoUsers.map((u) => u.email),
    keptAdmin: keepAdmin && admins[0] ? admins[0].email : null, counts: {}, realDependents: {},
  };
  const none = '00000000-0000-0000-0000-000000000000';
  const inU = userIds.length ? userIds : [none];

  const itemIds = ids(await q(Prisma.sql`SELECT id::text FROM "Item" WHERE id::text LIKE ${I} OR "ownerId"::text = ANY(${inU})`));
  const inI = itemIds.length ? itemIds : [none];
  const requestIds = ids(await q(Prisma.sql`SELECT id::text FROM "BorrowRequest"
    WHERE id::text LIKE ${R} OR "itemId"::text = ANY(${inI}) OR "borrowerId"::text = ANY(${inU}) OR "ownerId"::text = ANY(${inU})`));
  const inR = requestIds.length ? requestIds : [none];
  const txIds = ids(await q(Prisma.sql`SELECT id::text FROM "Transaction" WHERE id::text LIKE ${T} OR "requestId"::text = ANY(${inR})`));
  const inT = txIds.length ? txIds : [none];
  const reviewIds = ids(await q(Prisma.sql`SELECT id::text FROM "Review"
    WHERE "transactionId"::text = ANY(${inT}) OR "reviewerId"::text = ANY(${inU}) OR "reviewedUserId"::text = ANY(${inU})`));
  const convIds = ids(await q(Prisma.sql`SELECT id::text FROM "Conversation"
    WHERE "userAId"::text = ANY(${inU}) OR "userBId"::text = ANY(${inU}) OR "itemId"::text = ANY(${inI})`));
  const inC = convIds.length ? convIds : [none];
  const messageCount = (await q<{ n: bigint }>(Prisma.sql`SELECT count(*) AS n FROM "Message" WHERE "conversationId"::text = ANY(${inC}) OR "senderId"::text = ANY(${inU})`))[0]!.n;
  const notifIds = ids(await q(Prisma.sql`SELECT id::text FROM "Notification"
    WHERE "recipientId"::text = ANY(${inU})
       OR ("entityType" IN ('REQUEST','request') AND "entityId" = ANY(${inR}))
       OR ("entityType" IN ('ITEM','item') AND "entityId" = ANY(${inI}))
       OR ("entityType" IN ('CONVERSATION','conversation') AND "entityId" = ANY(${inC}))
       OR ("entityType" IN ('TRANSACTION','transaction') AND "entityId" = ANY(${inT}))
       OR ("entityType" IN ('USER','user') AND "entityId" = ANY(${inU}))`));
  const reportIds = ids(await q(Prisma.sql`SELECT id::text FROM "Report"
    WHERE "reporterId"::text = ANY(${inU}) OR "reportedUserId"::text = ANY(${inU}) OR "itemId"::text = ANY(${inI})`));
  const favCount = (await q<{ n: bigint }>(Prisma.sql`SELECT count(*) AS n FROM "Favorite" WHERE "userId"::text = ANY(${inU}) OR "itemId"::text = ANY(${inI})`))[0]!.n;

  report.counts = {
    members: userIds.length, listings: itemIds.length, requests: requestIds.length, transactions: txIds.length,
    reviews: reviewIds.length, conversations: convIds.length, messages: Number(messageCount),
    notifications: notifIds.length, reports: reportIds.length, favorites: Number(favCount),
  };

  // Records belonging to REAL members that would be removed only because they point at demo records.
  const count = async (sql: Prisma.Sql) => Number((await q<{ n: bigint }>(sql))[0]!.n);
  report.realDependents = {
    requests: await count(Prisma.sql`SELECT count(*) AS n FROM "BorrowRequest" WHERE id::text = ANY(${inR}) AND ("borrowerId"::text <> ALL(${inU}) OR "ownerId"::text <> ALL(${inU}))`),
    conversations: await count(Prisma.sql`SELECT count(*) AS n FROM "Conversation" WHERE id::text = ANY(${inC}) AND ("userAId"::text <> ALL(${inU}) OR "userBId"::text <> ALL(${inU}))`),
    reviews: await count(Prisma.sql`SELECT count(*) AS n FROM "Review" WHERE id::text = ANY(${reviewIds.length ? reviewIds : [none]}) AND ("reviewerId"::text <> ALL(${inU}) OR "reviewedUserId"::text <> ALL(${inU}))`),
    reports: await count(Prisma.sql`SELECT count(*) AS n FROM "Report" WHERE id::text = ANY(${reportIds.length ? reportIds : [none]}) AND "reporterId"::text <> ALL(${inU})`),
  };
  // A real member's own conversation/request with demo data is real activity: surface it, don't silently drop it.
  const hasRealDependents = Object.values(report.realDependents).some((n) => n > 0);

  if (!opts.apply) return report;
  if (hasRealDependents && !opts.includeRealDependents) {
    report.blocked = 'Real members have requests/conversations/reviews/reports involving demo records. Review them first, or re-run with --include-real-dependents.';
    return report;
  }
  if (userIds.length === 0) return { ...report, applied: true };

  await prisma.$transaction(async (tx) => {
    // Children first, so Restrict foreign keys are satisfied; all by explicit id lists.
    await tx.notification.deleteMany({ where: { id: { in: notifIds } } });
    await tx.review.deleteMany({ where: { id: { in: reviewIds } } });
    await tx.moderationAction.deleteMany({ where: { reportId: { in: reportIds } } });
    await tx.report.deleteMany({ where: { id: { in: reportIds } } });
    await tx.message.deleteMany({ where: { OR: [{ conversationId: { in: convIds } }, { senderId: { in: userIds } }] } });
    await tx.conversation.deleteMany({ where: { id: { in: convIds } } });
    await tx.transaction.deleteMany({ where: { id: { in: txIds } } });
    await tx.borrowRequest.deleteMany({ where: { id: { in: requestIds } } });
    await tx.favorite.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { itemId: { in: itemIds } }] } });
    await tx.item.deleteMany({ where: { id: { in: itemIds } } }); // images cascade
    await tx.user.deleteMany({ where: { id: { in: userIds } } }); // sessions, tokens, preferences cascade
  });
  report.applied = true;
  return report;
}
