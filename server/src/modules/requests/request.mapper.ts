import type { RequestDto } from '@borrowbox/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { briefUserSelect, buildTransactionDto, day, iso, itemBriefSelect, toItemBrief } from '../transactions/transaction.mapper';

export const requestInclude = (viewerId: string) =>
  ({
    item: { select: itemBriefSelect },
    borrower: { select: briefUserSelect },
    owner: { select: briefUserSelect },
    transaction: { include: { reviews: { where: { reviewerId: viewerId }, select: { id: true } } } },
  }) satisfies Prisma.BorrowRequestInclude;

export type RequestRow = Prisma.BorrowRequestGetPayload<{ include: ReturnType<typeof requestInclude> }>;

export async function ratingsFor(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { avg: number | null; count: number }>();
  const groups = await prisma.review.groupBy({
    by: ['reviewedUserId'],
    where: { reviewedUserId: { in: [...new Set(userIds)] } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return new Map(
    groups.map((g) => [
      g.reviewedUserId,
      { avg: g._avg.rating === null ? null : Math.round(g._avg.rating * 10) / 10, count: g._count.rating },
    ]),
  );
}

export function toRequestDto(
  row: RequestRow,
  viewerId: string,
  ratings: Map<string, { avg: number | null; count: number }>,
): RequestDto {
  const r = ratings.get(row.borrowerId);
  const showPickup = row.status === 'APPROVED' || row.status === 'COMPLETED';
  return {
    id: row.id,
    status: row.status,
    startDate: day(row.startDate),
    endDate: day(row.endDate),
    message: row.message,
    cancellationReason: row.cancellationReason,
    decisionAt: row.decisionAt ? iso(row.decisionAt) : null,
    createdAt: iso(row.createdAt),
    item: toItemBrief(row.item),
    borrower: { ...row.borrower, ratingAverage: r?.avg ?? null, ratingCount: r?.count ?? 0 },
    owner: row.owner,
    transaction: row.transaction
      ? (() => {
          const dto = buildTransactionDto(
            row.transaction,
            {
              startDate: row.startDate,
              endDate: row.endDate,
              ownerId: row.ownerId,
              item: row.item,
              borrower: row.borrower,
              owner: row.owner,
            },
            viewerId,
            row.transaction.reviews.length > 0,
          );
          return showPickup ? dto : { ...dto, pickupInstructions: null };
        })()
      : null,
  };
}
