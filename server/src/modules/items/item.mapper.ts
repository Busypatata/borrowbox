import type { ItemDetail, ItemSummary } from '@borrowbox/shared';
import { Prisma } from '@prisma/client';

export const itemInclude = (viewerId?: string) =>
  ({
    images: { orderBy: { sortOrder: 'asc' } },
    owner: { select: { id: true, name: true, profileImageUrl: true } },
    ...(viewerId ? { favorites: { where: { userId: viewerId }, select: { id: true } } } : {}),
  }) satisfies Prisma.ItemInclude;

/** Distance is shown rounded to the nearest 0.5 km so coordinates cannot be triangulated. */
export function approxDistance(km: number | null | undefined): number | null {
  if (km === null || km === undefined || Number.isNaN(km)) return null;
  return Math.max(0.5, Math.round(km * 2) / 2);
}

type ItemRow = Prisma.ItemGetPayload<{
  include: {
    images: true;
    owner: { select: { id: true; name: true; profileImageUrl: true } };
    favorites: { select: { id: true } };
  };
}>;

export function toSummary(row: Omit<ItemRow, 'favorites'> & { favorites?: { id: string }[] }, distanceKm: number | null): ItemSummary {
  const first = row.images[0];
  return {
    id: row.id,
    title: row.title,
    category: row.categorySlug,
    condition: row.condition,
    status: row.status,
    community: row.community,
    city: row.city,
    distanceKm: approxDistance(distanceKm),
    image: first ? { id: first.id, url: first.url, altText: first.altText || row.title, sortOrder: first.sortOrder } : null,
    owner: row.owner,
    favorited: (row.favorites?.length ?? 0) > 0,
    createdAt: row.createdAt.toISOString(),
  };
}

export type DetailExtras = Pick<ItemDetail, 'owner' | 'isOwner' | 'bookedRanges' | 'myActiveRequest' | 'pickupInstructions'>;

export function toDetail(
  row: Omit<ItemRow, 'favorites'> & { favorites?: { id: string }[] },
  distanceKm: number | null,
  extras: DetailExtras,
): ItemDetail {
  return {
    ...toSummary(row, distanceKm),
    description: row.description,
    images: row.images.map((i) => ({ id: i.id, url: i.url, altText: i.altText || row.title, sortOrder: i.sortOrder })),
    ...extras,
  };
}
