import type { Me, PublicUser } from '@borrowbox/shared';
import { prisma } from '../../config/prisma';
import { Errors } from '../../utils/errors';

export const briefSelect = { id: true, name: true, profileImageUrl: true } as const;

export async function userStats(userId: string) {
  const [itemsListed, completedLoans, completedBorrows, rating] = await Promise.all([
    prisma.item.count({ where: { ownerId: userId, status: { in: ['AVAILABLE', 'UNAVAILABLE'] } } }),
    prisma.transaction.count({ where: { status: 'COMPLETED', request: { ownerId: userId } } }),
    prisma.transaction.count({ where: { status: 'COMPLETED', request: { borrowerId: userId } } }),
    prisma.review.aggregate({ where: { reviewedUserId: userId }, _avg: { rating: true }, _count: { rating: true } }),
  ]);
  const avg = rating._avg.rating;
  return {
    itemsListed,
    completedLoans,
    completedBorrows,
    ratingAverage: avg === null ? null : Math.round(avg * 10) / 10,
    ratingCount: rating._count.rating,
  };
}

type UserRow = {
  id: string;
  name: string;
  profileImageUrl: string | null;
  bio: string | null;
  city: string | null;
  community: string | null;
  createdAt: Date;
  emailVerifiedAt: Date | null;
};

function base(u: UserRow, stats: Awaited<ReturnType<typeof userStats>>): PublicUser {
  return {
    id: u.id,
    name: u.name,
    profileImageUrl: u.profileImageUrl,
    bio: u.bio,
    city: u.city,
    community: u.community,
    createdAt: u.createdAt.toISOString(),
    verified: Boolean(u.emailVerifiedAt),
    ...stats,
  };
}

/** Public view: no email, no coordinates, no role. Suspended/deleted accounts are hidden. */
export async function toPublicUser(userId: string): Promise<PublicUser> {
  const u = await prisma.user.findFirst({ where: { id: userId, accountStatus: 'ACTIVE' } });
  if (!u) throw Errors.notFound('User');
  return base(u, await userStats(userId));
}

export async function toMe(userId: string): Promise<Me> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw Errors.unauthenticated();
  return {
    ...base(u, await userStats(userId)),
    email: u.email,
    emailVerified: Boolean(u.emailVerifiedAt),
    role: u.role,
    latitude: u.latitude,
    longitude: u.longitude,
  };
}
