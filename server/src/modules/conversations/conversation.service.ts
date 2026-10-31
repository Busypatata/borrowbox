import { Prisma } from '@prisma/client';
import type { ConversationDto, MessageDto } from '@borrowbox/shared';
import { prisma } from '../../config/prisma';
import { Errors, isUniqueViolation } from '../../utils/errors';
import { notify } from '../../services/notification.service';
import { conversationKey } from '../../utils/conversationKey';

const brief = { id: true, name: true, profileImageUrl: true } as const;

export { conversationKey };

type ConvRow = Prisma.ConversationGetPayload<{
  include: { userA: { select: typeof brief }; userB: { select: typeof brief }; item: { select: { id: true; title: true } } };
}>;
const convInclude = {
  userA: { select: brief },
  userB: { select: brief },
  item: { select: { id: true, title: true } },
} satisfies Prisma.ConversationInclude;

const toMessage = (m: { id: string; conversationId: string; senderId: string; body: string; createdAt: Date }): MessageDto => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
});

function otherOf(c: ConvRow, me: string) {
  return c.userAId === me ? c.userB : c.userA;
}

async function enrich(rows: ConvRow[], me: string): Promise<ConversationDto[]> {
  if (rows.length === 0) return [];
  const ids = Prisma.join(rows.map((r) => Prisma.sql`${r.id}::uuid`));
  const [lasts, unread] = await Promise.all([
    prisma.$queryRaw<{ id: string; conversationId: string; senderId: string; body: string; createdAt: Date }[]>`
      SELECT DISTINCT ON (m."conversationId") m."id", m."conversationId", m."senderId", m."body", m."createdAt"
      FROM "Message" m WHERE m."conversationId" IN (${ids})
      ORDER BY m."conversationId", m."createdAt" DESC`,
    prisma.$queryRaw<{ conversationId: string; count: number }[]>`
      SELECT c."id" AS "conversationId", COUNT(m."id")::int AS count
      FROM "Conversation" c JOIN "Message" m ON m."conversationId" = c."id"
      WHERE c."id" IN (${ids}) AND m."senderId" <> ${me}::uuid
        AND m."createdAt" > (CASE WHEN c."userAId" = ${me}::uuid THEN c."aLastReadAt" ELSE c."bLastReadAt" END)
      GROUP BY c."id"`,
  ]);
  const lastBy = new Map(lasts.map((m) => [m.conversationId, m]));
  const unreadBy = new Map(unread.map((u) => [u.conversationId, u.count]));
  return rows.map((r) => {
    const last = lastBy.get(r.id);
    return {
      id: r.id,
      other: otherOf(r, me),
      item: r.item,
      lastMessage: last ? toMessage(last) : null,
      unreadCount: unreadBy.get(r.id) ?? 0,
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

async function participantConversation(conversationId: string, userId: string) {
  const c = await prisma.conversation.findUnique({ where: { id: conversationId }, include: convInclude });
  if (!c || (c.userAId !== userId && c.userBId !== userId)) throw Errors.notFound('Conversation');
  return c;
}

export async function getConversation(conversationId: string, userId: string) {
  const c = await participantConversation(conversationId, userId);
  return (await enrich([c], userId))[0] as ConversationDto;
}

export async function createOrGetConversation(
  userId: string,
  input: { recipientId: string; itemId?: string; requestId?: string },
) {
  if (input.recipientId === userId) throw Errors.badRequest("You can't start a conversation with yourself.");
  const recipient = await prisma.user.findFirst({ where: { id: input.recipientId, accountStatus: 'ACTIVE' }, select: { id: true } });
  if (!recipient) throw Errors.notFound('User');

  let itemId = input.itemId ?? null;
  const requestId = input.requestId ?? null;
  if (requestId) {
    const r = await prisma.borrowRequest.findUnique({ where: { id: requestId } });
    const parties = r ? [r.borrowerId, r.ownerId] : [];
    if (!r || !parties.includes(userId) || !parties.includes(input.recipientId)) throw Errors.notFound('Request');
    itemId = r.itemId;
  } else if (itemId) {
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { ownerId: true, status: true } });
    if (!item || (item.ownerId !== userId && item.ownerId !== input.recipientId)) throw Errors.notFound('Item');
    if (item.ownerId !== userId && (item.status === 'ARCHIVED' || item.status === 'HIDDEN')) throw Errors.notFound('Item');
  }

  const key = conversationKey(userId, input.recipientId, itemId);
  const [userAId, userBId] = [userId, input.recipientId].sort() as [string, string];
  let conv = await prisma.conversation.findUnique({ where: { key }, include: convInclude });
  if (!conv) {
    try {
      conv = await prisma.conversation.create({
        data: { key, userAId, userBId, itemId, requestId },
        include: convInclude,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      conv = await prisma.conversation.findUnique({ where: { key }, include: convInclude });
    }
  }
  if (!conv) throw Errors.notFound('Conversation');
  return (await enrich([conv], userId))[0] as ConversationDto;
}

export async function listConversations(userId: string, page: number, pageSize: number) {
  const where = { OR: [{ userAId: userId }, { userBId: userId }] };
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: convInclude,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.conversation.count({ where }),
  ]);
  return { data: await enrich(rows, userId), total };
}

export async function unreadMessageCount(userId: string): Promise<number> {
  const r = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Message" m JOIN "Conversation" c ON c."id" = m."conversationId"
    WHERE m."senderId" <> ${userId}::uuid
      AND ((c."userAId" = ${userId}::uuid AND m."createdAt" > c."aLastReadAt")
        OR (c."userBId" = ${userId}::uuid AND m."createdAt" > c."bLastReadAt"))`;
  return Number(r[0]?.count ?? 0);
}

/** Newest-first paging via a `before` message-id cursor; returned oldest→newest for display. */
export async function listMessages(conversationId: string, userId: string, opts: { before?: string; limit: number }) {
  await participantConversation(conversationId, userId);
  let cursor: { createdAt: Date; id: string } | null = null;
  if (opts.before) {
    const c = await prisma.message.findFirst({ where: { id: opts.before, conversationId }, select: { createdAt: true, id: true } });
    if (!c) throw Errors.badRequest('Invalid cursor.');
    cursor = c;
  }
  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursor
        ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
  });
  const hasMore = rows.length > opts.limit;
  const page = rows.slice(0, opts.limit).reverse();
  return { messages: page.map(toMessage), hasMore, nextCursor: hasMore ? (page[0]?.id ?? null) : null };
}

export async function sendMessage(conversationId: string, userId: string, body: string, clientId?: string): Promise<MessageDto> {
  const conv = await participantConversation(conversationId, userId);
  const other = otherOf(conv, userId);
  const otherActive = await prisma.user.findFirst({ where: { id: other.id, accountStatus: 'ACTIVE' }, select: { id: true } });
  if (!otherActive) throw Errors.invalidState('This member is no longer available to message.');

  if (clientId) {
    const dup = await prisma.message.findFirst({ where: { conversationId, senderId: userId, clientId } });
    if (dup) return toMessage(dup); // retried send: return the original, never a duplicate
  }
  const senderIsA = conv.userAId === userId;
  const sender = conv.userAId === userId ? conv.userA : conv.userB;

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({ data: { conversationId, senderId: userId, body, clientId: clientId ?? null } });
    const now = new Date();
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: now, ...(senderIsA ? { aLastReadAt: now } : { bLastReadAt: now }) },
    });
    // One unread "new message" notification per conversation (avoids notification spam).
    const existing = await tx.notification.findFirst({
      where: { recipientId: other.id, type: 'NEW_MESSAGE', entityId: conversationId, readAt: null },
      select: { id: true },
    });
    if (!existing) {
      await notify(tx, {
        recipientId: other.id,
        type: 'NEW_MESSAGE',
        title: 'New message',
        body: `${sender.name} sent you a message.`,
        entityType: 'conversation',
        entityId: conversationId,
      });
    }
    return m;
  }).catch(async (err) => {
    if (clientId && isUniqueViolation(err)) {
      const dup = await prisma.message.findFirst({ where: { conversationId, senderId: userId, clientId } });
      if (dup) return dup;
    }
    throw err;
  });
  return toMessage(message);
}

export async function markRead(conversationId: string, userId: string) {
  const conv = await participantConversation(conversationId, userId);
  const now = new Date();
  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversationId },
      data: conv.userAId === userId ? { aLastReadAt: now } : { bLastReadAt: now },
      select: { id: true },
    }),
    prisma.notification.updateMany({
      where: { recipientId: userId, type: 'NEW_MESSAGE', entityId: conversationId, readAt: null },
      data: { readAt: now },
    }),
  ]);
}
