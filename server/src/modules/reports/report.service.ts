import { prisma } from '../../config/prisma';
import { Errors } from '../../utils/errors';
import { notify } from '../../services/notification.service';

export async function createReport(
  reporterId: string,
  input: { itemId?: string; userId?: string; reason: 'SPAM_OR_MISLEADING' | 'INAPPROPRIATE_CONTENT' | 'SUSPICIOUS_BEHAVIOUR' | 'SAFETY_CONCERN' | 'OTHER'; details?: string },
) {
  if (input.itemId) {
    const item = await prisma.item.findUnique({ where: { id: input.itemId }, select: { ownerId: true } });
    if (!item) throw Errors.notFound('Item');
    if (item.ownerId === reporterId) throw Errors.badRequest("You can't report your own listing.");
  }
  if (input.userId) {
    if (input.userId === reporterId) throw Errors.badRequest("You can't report yourself.");
    const user = await prisma.user.findFirst({ where: { id: input.userId, accountStatus: 'ACTIVE' }, select: { id: true } });
    if (!user) throw Errors.notFound('User');
  }
  const dup = await prisma.report.findFirst({
    where: {
      reporterId,
      status: 'OPEN',
      ...(input.itemId ? { itemId: input.itemId } : { reportedUserId: input.userId }),
    },
    select: { id: true },
  });
  if (dup) throw Errors.conflict('You already have an open report for this. Our team will review it.');

  const r = await prisma.report.create({
    data: {
      reporterId,
      itemId: input.itemId ?? null,
      reportedUserId: input.userId ?? null,
      reason: input.reason,
      details: input.details || null,
    },
  });
  return { id: r.id, status: r.status, createdAt: r.createdAt.toISOString() };
}

const briefUser = { id: true, name: true, profileImageUrl: true, accountStatus: true, createdAt: true } as const;

export async function adminListReports(opts: { status?: string; page: number; pageSize: number }) {
  const where = opts.status && ['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED'].includes(opts.status) ? { status: opts.status as 'OPEN' } : {};
  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, name: true } },
        item: { select: { id: true, title: true, status: true } },
        reportedUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.report.count({ where }),
  ]);
  return { data: rows, total };
}

export async function adminGetReport(id: string) {
  const r = await prisma.report.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, name: true } },
      item: {
        select: {
          id: true, title: true, description: true, status: true, community: true, createdAt: true,
          images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true } },
          owner: { select: briefUser },
        },
      },
      reportedUser: { select: briefUser },
      actions: { orderBy: { createdAt: 'desc' }, include: { admin: { select: { id: true, name: true } } } },
    },
  });
  if (!r) throw Errors.notFound('Report');
  return r;
}

export async function adminResolveReport(
  adminId: string,
  id: string,
  input: { status: 'REVIEWED' | 'ACTIONED' | 'DISMISSED'; note?: string; hideItem?: boolean },
) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw Errors.notFound('Report');
  await prisma.$transaction(async (tx) => {
    if (input.hideItem) {
      if (!report.itemId) throw Errors.badRequest('This report is not about a listing.');
      await setItemVisibility(tx as never, adminId, report.itemId, true, report.id, input.note);
    }
    await tx.report.update({ where: { id }, data: { status: input.status, reviewedAt: new Date() } });
    await tx.moderationAction.create({
      data: {
        adminId,
        reportId: id,
        action: `REPORT_${input.status}`,
        targetType: report.itemId ? 'item' : 'user',
        targetId: (report.itemId ?? report.reportedUserId) as string,
        note: input.note ?? null,
      },
    });
  });
}

type Db = Pick<typeof prisma, 'item' | 'moderationAction' | 'borrowRequest' | 'notification' | 'notificationPreference'>;

async function setItemVisibility(db: Db, adminId: string, itemId: string, hide: boolean, reportId?: string, note?: string) {
  const item = await db.item.findUnique({ where: { id: itemId } });
  if (!item) throw Errors.notFound('Item');
  if (hide && item.status === 'HIDDEN') return;
  if (!hide && item.status !== 'HIDDEN') throw Errors.invalidState('This listing is not hidden.');
  await db.item.update({ where: { id: itemId }, data: { status: hide ? 'HIDDEN' : 'AVAILABLE', archivedAt: null } });
  await db.moderationAction.create({
    data: { adminId, reportId: reportId ?? null, action: hide ? 'ITEM_HIDDEN' : 'ITEM_RESTORED', targetType: 'item', targetId: itemId, note: note ?? null },
  });
  await notify(db as never, {
    recipientId: item.ownerId,
    type: 'SECURITY',
    title: hide ? 'Your listing was hidden' : 'Your listing was restored',
    body: hide
      ? `Moderators hid "${item.title}" after a report. Contact support if you think this is a mistake.`
      : `Moderators restored "${item.title}".`,
    entityType: 'item',
    entityId: itemId,
  });
}

export async function adminSetItemVisibility(adminId: string, itemId: string, hide: boolean, note?: string) {
  await prisma.$transaction(async (tx) => setItemVisibility(tx as never, adminId, itemId, hide, undefined, note));
}
