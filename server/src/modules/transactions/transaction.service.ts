import type { TransactionDto, TransactionStatus, TxAction } from '@borrowbox/shared';
import { TX_ACTIONS } from '@borrowbox/shared';
import { prisma } from '../../config/prisma';
import { Errors } from '../../utils/errors';
import { emailNotificationLater, notify } from '../../services/notification.service';
import { toTransactionDto, txInclude } from './transaction.mapper';

export async function getTransaction(transactionId: string, viewerId: string): Promise<TransactionDto> {
  const row = await prisma.transaction.findUnique({ where: { id: transactionId }, include: txInclude(viewerId) });
  if (!row || (row.request.ownerId !== viewerId && row.request.borrowerId !== viewerId)) throw Errors.notFound('Transaction');
  return toTransactionDto(row, viewerId);
}

export async function listTransactions(
  userId: string,
  opts: { statuses?: TransactionStatus[]; role?: 'OWNER' | 'BORROWER'; page: number; pageSize: number },
) {
  const party =
    opts.role === 'OWNER'
      ? { ownerId: userId }
      : opts.role === 'BORROWER'
        ? { borrowerId: userId }
        : { OR: [{ ownerId: userId }, { borrowerId: userId }] };
  const where = { request: party, ...(opts.statuses?.length ? { status: { in: opts.statuses } } : {}) };
  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: txInclude(userId),
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);
  return { data: rows.map((r) => toTransactionDto(r, userId)), total };
}

const MESSAGES: Record<TxAction, { type: 'HANDOVER_CONFIRMED' | 'RETURN_REQUESTED' | 'RETURN_CONFIRMED'; title: string; body: (item: string) => string; to: 'OWNER' | 'BORROWER' }> = {
  'confirm-handover': {
    type: 'HANDOVER_CONFIRMED',
    title: 'Handover confirmed',
    body: (item) => `The owner confirmed that "${item}" was handed over to you.`,
    to: 'BORROWER',
  },
  'request-return': {
    type: 'RETURN_REQUESTED',
    title: 'Return requested',
    body: (item) => `The borrower says "${item}" is ready to be returned. Please confirm once you have it back.`,
    to: 'OWNER',
  },
  'confirm-return': {
    type: 'RETURN_CONFIRMED',
    title: 'Return confirmed',
    body: (item) => `"${item}" is back with its owner. The loan is complete — leave a review!`,
    to: 'BORROWER',
  },
};

/**
 * The ONE place transaction status transitions happen. The client can only name an action;
 * who may perform it and from which status is decided here from TX_ACTIONS.
 */
export async function performAction(transactionId: string, userId: string, action: TxAction): Promise<TransactionDto> {
  const rule = TX_ACTIONS[action];
  const msg = MESSAGES[action];
  let notice: { to: string; title: string; body: string; type: typeof msg.type } | null = null;

  await prisma.$transaction(async (tx) => {
    const row = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { request: { include: { item: { select: { title: true } } } } },
    });
    if (!row || (row.request.ownerId !== userId && row.request.borrowerId !== userId)) throw Errors.notFound('Transaction');

    const role = row.request.ownerId === userId ? 'OWNER' : 'BORROWER';
    if (role !== rule.role) {
      throw Errors.forbidden(rule.role === 'OWNER' ? 'Only the item owner can do this.' : 'Only the borrower can do this.');
    }
    if (!rule.from.includes(row.status)) {
      throw Errors.invalidState(`This can't be done while the borrowing is "${row.status.replace(/_/g, ' ').toLowerCase()}".`);
    }

    const now = new Date();
    const data =
      action === 'confirm-handover'
        ? { status: rule.to, handoverConfirmedAt: now }
        : action === 'request-return'
          ? { status: rule.to, returnRequestedAt: now }
          : { status: rule.to, returnConfirmedAt: now, completedAt: now };

    // Conditional update: a concurrent/duplicate call can't apply the transition twice.
    const claimed = await tx.transaction.updateMany({
      where: { id: row.id, status: { in: rule.from } },
      data,
    });
    if (claimed.count !== 1) throw Errors.invalidState('This was just updated. Please refresh.');

    if (action === 'confirm-return') {
      await tx.borrowRequest.update({ where: { id: row.requestId }, data: { status: 'COMPLETED' } });
    }
    const recipientId = msg.to === 'OWNER' ? row.request.ownerId : row.request.borrowerId;
    const body = msg.body(row.request.item.title);
    await notify(tx, {
      recipientId,
      type: msg.type,
      title: msg.title,
      body,
      entityType: 'transaction',
      entityId: row.id,
      dedupeKey: `tx:${row.id}:${action}`,
    });
    notice = { to: recipientId, title: msg.title, body, type: msg.type };
  });

  if (notice) {
    const n = notice as { to: string; title: string; body: string; type: typeof msg.type };
    emailNotificationLater(n.to, n.title, n.body, n.type);
  }
  return getTransaction(transactionId, userId);
}
