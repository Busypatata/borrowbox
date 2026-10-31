import type { UpdateProfileInput } from '@borrowbox/shared';
import { prisma } from '../../config/prisma';
import { Errors } from '../../utils/errors';
import { hashPassword, randomToken, verifyPassword } from '../../utils/crypto';
import { deleteImage, storeImage } from '../../services/storage.service';
import { notify } from '../../services/notification.service';
import { toMe } from './user.mapper';

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  // Only whitelisted fields from the validated schema are ever written.
  const data: Record<string, unknown> = {};
  for (const k of ['name', 'bio', 'city', 'community', 'latitude', 'longitude'] as const) {
    if (input[k] !== undefined) data[k] = input[k] === '' ? null : input[k];
  }
  if (('latitude' in data) !== ('longitude' in data)) {
    throw Errors.validation({ latitude: 'Provide both latitude and longitude, or neither.' });
  }
  await prisma.user.update({ where: { id: userId }, data });
  return toMe(userId);
}

export async function getNotificationPrefs(userId: string) {
  const p = await prisma.notificationPreference.upsert({ where: { userId }, update: {}, create: { userId } });
  return { requestUpdates: p.requestUpdates, messages: p.messages, reviews: p.reviews, emailEnabled: p.emailEnabled };
}

export async function updateNotificationPrefs(
  userId: string,
  input: Partial<{ requestUpdates: boolean; messages: boolean; reviews: boolean; emailEnabled: boolean }>,
) {
  const p = await prisma.notificationPreference.upsert({ where: { userId }, update: input, create: { userId, ...input } });
  return { requestUpdates: p.requestUpdates, messages: p.messages, reviews: p.reviews, emailEnabled: p.emailEnabled };
}

export async function dashboardStats(userId: string) {
  const [incomingPending, outgoingPending, activeBorrowings, activeLending, itemsListed, unreadNotifications, unreadMessages] =
    await Promise.all([
      prisma.borrowRequest.count({ where: { ownerId: userId, status: 'PENDING' } }),
      prisma.borrowRequest.count({ where: { borrowerId: userId, status: 'PENDING' } }),
      prisma.transaction.count({
        where: { status: { in: ['AWAITING_HANDOVER', 'BORROWED', 'RETURN_REQUESTED'] }, request: { borrowerId: userId } },
      }),
      prisma.transaction.count({
        where: { status: { in: ['AWAITING_HANDOVER', 'BORROWED', 'RETURN_REQUESTED'] }, request: { ownerId: userId } },
      }),
      prisma.item.count({ where: { ownerId: userId, status: { in: ['AVAILABLE', 'UNAVAILABLE'] } } }),
      prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Message" m
        JOIN "Conversation" c ON c."id" = m."conversationId"
        WHERE m."senderId" <> ${userId}::uuid
          AND ((c."userAId" = ${userId}::uuid AND m."createdAt" > c."aLastReadAt")
            OR (c."userBId" = ${userId}::uuid AND m."createdAt" > c."bLastReadAt"))`,
    ]);
  return {
    incomingPending,
    outgoingPending,
    activeBorrowings,
    activeLending,
    itemsListed,
    unreadNotifications,
    unreadMessages: Number(unreadMessages[0]?.count ?? 0),
  };
}

const ACTIVE_TX = ['AWAITING_HANDOVER', 'BORROWED', 'RETURN_REQUESTED'] as const;

/**
 * Soft-deletes the account. History (requests, transactions, reviews, messages) is retained for
 * the other party's records but the person is anonymised and can no longer sign in.
 */
export async function deleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.unauthenticated();
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw Errors.validation({ password: 'Password is incorrect.' });
  }
  const active = await prisma.transaction.count({
    where: { status: { in: [...ACTIVE_TX] }, request: { OR: [{ borrowerId: userId }, { ownerId: userId }] } },
  });
  if (active > 0) {
    throw Errors.invalidState('You have borrowings in progress. Complete or resolve them before deleting your account.');
  }

  const images = await prisma.itemImage.findMany({ where: { item: { ownerId: userId } }, select: { storageKey: true } });
  const tombstonePassword = await hashPassword(randomToken(32));

  await prisma.$transaction(async (tx) => {
    const pending = await tx.borrowRequest.findMany({
      where: { status: 'PENDING', OR: [{ borrowerId: userId }, { ownerId: userId }] },
      select: { id: true, borrowerId: true, ownerId: true },
    });
    for (const r of pending) {
      const iAmOwner = r.ownerId === userId;
      await tx.borrowRequest.update({
        where: { id: r.id },
        data: {
          status: iAmOwner ? 'DECLINED' : 'CANCELLED',
          decisionAt: new Date(),
          cancellationReason: 'Account closed',
        },
      });
      await notify(tx, {
        recipientId: iAmOwner ? r.borrowerId : r.ownerId,
        type: iAmOwner ? 'REQUEST_DECLINED' : 'REQUEST_CANCELLED',
        title: iAmOwner ? 'Request declined' : 'Request cancelled',
        body: 'The other member closed their account.',
        entityType: 'request',
        entityId: r.id,
        dedupeKey: `acct-closed:${r.id}`,
      });
    }
    await tx.item.updateMany({ where: { ownerId: userId }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
    await tx.itemImage.deleteMany({ where: { item: { ownerId: userId } } });
    await tx.favorite.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { recipientId: userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'DELETED',
        name: 'Deleted user',
        email: `deleted-${userId}@deleted.invalid`,
        passwordHash: tombstonePassword,
        profileImageUrl: null,
        bio: null,
        city: null,
        community: null,
        latitude: null,
        longitude: null,
        emailVerifiedAt: null,
      },
    });
  });
  await Promise.all(images.map((i) => deleteImage(i.storageKey)));
}

export async function setAvatar(userId: string, file: { buffer: Buffer; size: number }) {
  const stored = await storeImage(file);
  await prisma.user.update({ where: { id: userId }, data: { profileImageUrl: stored.url } });
  return toMe(userId);
}

export async function removeAvatar(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { profileImageUrl: null } });
  return toMe(userId);
}
