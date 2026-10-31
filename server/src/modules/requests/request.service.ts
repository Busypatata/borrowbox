import type { CreateRequestInput, RequestDto } from '@borrowbox/shared';
import { DATE_RANGE_MESSAGES, parseDateOnly, todayUtc, validateDateRange } from '@borrowbox/shared';
import type { RequestStatus } from '@prisma/client';
import { prisma, type Tx } from '../../config/prisma';
import { env } from '../../config/env';
import { Errors, isExclusionViolation } from '../../utils/errors';
import { emailNotificationLater, notify } from '../../services/notification.service';
import { ratingsFor, requestInclude, toRequestDto } from './request.mapper';

const lockItem = (tx: Tx, itemId: string) => tx.$queryRaw`SELECT "id" FROM "Item" WHERE "id" = ${itemId}::uuid FOR UPDATE`;
const overlapWhere = (start: Date, end: Date) => ({ startDate: { lte: end }, endDate: { gte: start } });

export async function getRequestDto(requestId: string, viewerId: string): Promise<RequestDto> {
  const row = await prisma.borrowRequest.findUnique({ where: { id: requestId }, include: requestInclude(viewerId) });
  // Non-participants get 404 so request ids cannot be probed.
  if (!row || (row.borrowerId !== viewerId && row.ownerId !== viewerId)) throw Errors.notFound('Request');
  return toRequestDto(row, viewerId, await ratingsFor([row.borrowerId]));
}

export async function createRequest(borrowerId: string, input: CreateRequestInput): Promise<RequestDto> {
  const rangeError = validateDateRange(input.startDate, input.endDate, new Date(), env.MAX_BOOKING_DAYS);
  if (rangeError) throw Errors.validation({ startDate: DATE_RANGE_MESSAGES[rangeError] });
  const start = parseDateOnly(input.startDate);
  const end = parseDateOnly(input.endDate);

  const created = await prisma.$transaction(async (tx) => {
    // Serialise all booking activity for this item (also de-duplicates double submits).
    await lockItem(tx, input.itemId);
    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      include: { owner: { select: { accountStatus: true } } },
    });
    if (!item || item.owner.accountStatus !== 'ACTIVE' || item.status === 'ARCHIVED' || item.status === 'HIDDEN') {
      throw Errors.notFound('Item');
    }
    if (item.ownerId === borrowerId) throw Errors.forbidden("You can't borrow your own item.");
    if (item.status !== 'AVAILABLE') throw Errors.invalidState('This item is not available right now.');

    const dup = await tx.borrowRequest.findFirst({
      where: { itemId: item.id, borrowerId, status: { in: ['PENDING', 'APPROVED'] }, ...overlapWhere(start, end) },
      select: { id: true },
    });
    if (dup) throw Errors.conflict('You already have an active request for this item on overlapping dates.');

    const booked = await tx.borrowRequest.findFirst({
      where: { itemId: item.id, status: 'APPROVED', ...overlapWhere(start, end) },
      select: { id: true },
    });
    if (booked) throw Errors.bookingConflict('This item is already booked for some of those dates.');

    const request = await tx.borrowRequest.create({
      data: {
        itemId: item.id,
        borrowerId,
        ownerId: item.ownerId,
        startDate: start,
        endDate: end,
        message: input.message || null,
      },
    });
    const borrower = await tx.user.findUnique({ where: { id: borrowerId }, select: { name: true } });
    const title = 'New borrowing request';
    const body = `${borrower?.name ?? 'Someone'} wants to borrow "${item.title}" (${input.startDate} → ${input.endDate}).`;
    await notify(tx, {
      recipientId: item.ownerId,
      type: 'REQUEST_RECEIVED',
      title,
      body,
      entityType: 'request',
      entityId: request.id,
      dedupeKey: `req-received:${request.id}`,
    });
    return { request, ownerId: item.ownerId, title, body };
  });

  emailNotificationLater(created.ownerId, created.title, created.body, 'REQUEST_RECEIVED');
  return getRequestDto(created.request.id, borrowerId);
}

export async function listRequests(
  userId: string,
  side: 'incoming' | 'outgoing',
  opts: { statuses?: RequestStatus[]; page: number; pageSize: number },
) {
  const where = {
    ...(side === 'incoming' ? { ownerId: userId } : { borrowerId: userId }),
    ...(opts.statuses?.length ? { status: { in: opts.statuses } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.borrowRequest.findMany({
      where,
      include: requestInclude(userId),
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.borrowRequest.count({ where }),
  ]);
  const ratings = await ratingsFor(rows.map((r) => r.borrowerId));
  return { data: rows.map((r) => toRequestDto(r, userId, ratings)), total };
}

/** Loads the request inside a transaction and enforces who may act on it. */
async function loadForAction(tx: Tx, requestId: string, userId: string, role: 'owner' | 'borrower') {
  const req = await tx.borrowRequest.findUnique({ where: { id: requestId }, include: { item: { select: { title: true, status: true } } } });
  if (!req || (req.ownerId !== userId && req.borrowerId !== userId)) throw Errors.notFound('Request');
  if (role === 'owner' && req.ownerId !== userId) throw Errors.forbidden('Only the item owner can do this.');
  if (role === 'borrower' && req.borrowerId !== userId) throw Errors.forbidden('Only the borrower can do this.');
  return req;
}

export async function approveRequest(requestId: string, ownerId: string): Promise<RequestDto> {
  let notified: { to: string; title: string; body: string } | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const pre = await tx.borrowRequest.findUnique({ where: { id: requestId }, select: { itemId: true } });
      if (!pre) throw Errors.notFound('Request');
      await lockItem(tx, pre.itemId); // 1. serialise per item
      const req = await loadForAction(tx, requestId, ownerId, 'owner'); // 2. owner check, fresh state under lock

      if (req.status !== 'PENDING') {
        throw Errors.invalidState(`This request is already ${req.status.toLowerCase()} and can no longer be approved.`);
      }
      if (req.item.status !== 'AVAILABLE') throw Errors.invalidState('This listing is not available, so the request cannot be approved.');
      if (req.endDate < parseDateOnly(todayUtc()) || req.startDate < parseDateOnly(todayUtc())) {
        throw Errors.invalidState('The requested start date has already passed. Ask the borrower to send a new request.');
      }
      const conflict = await tx.borrowRequest.findFirst({
        where: { itemId: req.itemId, status: 'APPROVED', id: { not: req.id }, ...overlapWhere(req.startDate, req.endDate) },
        select: { id: true },
      });
      if (conflict) throw Errors.bookingConflict('Another approved booking already covers some of these dates.');

      const claimed = await tx.borrowRequest.updateMany({
        where: { id: req.id, status: 'PENDING' },
        data: { status: 'APPROVED', decisionAt: new Date() },
      });
      if (claimed.count !== 1) throw Errors.invalidState('This request was just updated. Please refresh.');
      await tx.transaction.create({ data: { requestId: req.id } });

      // Competing pending requests for overlapping dates can no longer be satisfied.
      const losers = await tx.borrowRequest.findMany({
        where: { itemId: req.itemId, status: 'PENDING', id: { not: req.id }, ...overlapWhere(req.startDate, req.endDate) },
        select: { id: true, borrowerId: true },
      });
      if (losers.length) {
        await tx.borrowRequest.updateMany({
          where: { id: { in: losers.map((l) => l.id) }, status: 'PENDING' },
          data: { status: 'DECLINED', decisionAt: new Date(), cancellationReason: 'The item was booked for overlapping dates.' },
        });
        for (const l of losers) {
          await notify(tx, {
            recipientId: l.borrowerId,
            type: 'REQUEST_DECLINED',
            title: 'Request declined',
            body: `"${req.item.title}" was booked by someone else for overlapping dates.`,
            entityType: 'request',
            entityId: l.id,
            dedupeKey: `req-declined:${l.id}`,
          });
        }
      }
      const title = 'Request approved';
      const body = `Your request to borrow "${req.item.title}" was approved. Message the owner to arrange pickup.`;
      await notify(tx, {
        recipientId: req.borrowerId,
        type: 'REQUEST_APPROVED',
        title,
        body,
        entityType: 'request',
        entityId: req.id,
        dedupeKey: `req-approved:${req.id}`,
      });
      notified = { to: req.borrowerId, title, body };
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw Errors.bookingConflict('Another approved booking already covers some of these dates.');
    throw err;
  }
  if (notified) {
    const n = notified as { to: string; title: string; body: string };
    emailNotificationLater(n.to, n.title, n.body, 'REQUEST_APPROVED');
  }
  return getRequestDto(requestId, ownerId);
}

export async function declineRequest(requestId: string, ownerId: string, reason?: string): Promise<RequestDto> {
  let notified: { to: string; title: string; body: string } | null = null;
  await prisma.$transaction(async (tx) => {
    const req = await loadForAction(tx, requestId, ownerId, 'owner');
    if (req.status !== 'PENDING') throw Errors.invalidState(`This request is already ${req.status.toLowerCase()}.`);
    const claimed = await tx.borrowRequest.updateMany({
      where: { id: req.id, status: 'PENDING' },
      data: { status: 'DECLINED', decisionAt: new Date(), cancellationReason: reason || null },
    });
    if (claimed.count !== 1) throw Errors.invalidState('This request was just updated. Please refresh.');
    const title = 'Request declined';
    const body = `Your request to borrow "${req.item.title}" was declined.${reason ? ` Reason: ${reason}` : ''}`;
    await notify(tx, {
      recipientId: req.borrowerId,
      type: 'REQUEST_DECLINED',
      title,
      body,
      entityType: 'request',
      entityId: req.id,
      dedupeKey: `req-declined:${req.id}`,
    });
    notified = { to: req.borrowerId, title, body };
  });
  if (notified) {
    const n = notified as { to: string; title: string; body: string };
    emailNotificationLater(n.to, n.title, n.body, 'REQUEST_DECLINED');
  }
  return getRequestDto(requestId, ownerId);
}

/**
 * Policy: borrowers may cancel PENDING requests only. Once approved, a booking cannot be cancelled
 * through this endpoint — the parties coordinate via messages (documented MVP limitation).
 */
export async function cancelRequest(requestId: string, borrowerId: string, reason?: string): Promise<RequestDto> {
  await prisma.$transaction(async (tx) => {
    const req = await loadForAction(tx, requestId, borrowerId, 'borrower');
    if (req.status === 'APPROVED') {
      throw Errors.invalidState('Approved bookings cannot be cancelled here. Please message the owner to arrange changes.');
    }
    if (req.status !== 'PENDING') throw Errors.invalidState(`This request is already ${req.status.toLowerCase()}.`);
    const claimed = await tx.borrowRequest.updateMany({
      where: { id: req.id, status: 'PENDING' },
      data: { status: 'CANCELLED', decisionAt: new Date(), cancellationReason: reason || null },
    });
    if (claimed.count !== 1) throw Errors.invalidState('This request was just updated. Please refresh.');
    await notify(tx, {
      recipientId: req.ownerId,
      type: 'REQUEST_CANCELLED',
      title: 'Request cancelled',
      body: `A request for "${req.item.title}" was cancelled by the borrower.`,
      entityType: 'request',
      entityId: req.id,
      dedupeKey: `req-cancelled:${req.id}`,
    });
  });
  return getRequestDto(requestId, borrowerId);
}
