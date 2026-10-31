import type { TransactionDto } from '@borrowbox/shared';
import type { Prisma } from '@prisma/client';

export const briefUserSelect = { id: true, name: true, profileImageUrl: true } as const;
export const itemBriefSelect = {
  id: true,
  title: true,
  community: true,
  pickupInstructions: true,
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
} satisfies Prisma.ItemSelect;

export const iso = (d: Date) => d.toISOString();
export const day = (d: Date) => d.toISOString().slice(0, 10);

type ItemBrief = Prisma.ItemGetPayload<{ select: typeof itemBriefSelect }>;
type UserBrief = { id: string; name: string; profileImageUrl: string | null };

export function toItemBrief(item: ItemBrief) {
  const first = item.images[0];
  return {
    id: item.id,
    title: item.title,
    community: item.community,
    image: first ? { id: first.id, url: first.url, altText: first.altText || item.title, sortOrder: first.sortOrder } : null,
  };
}

interface TxCore {
  id: string;
  requestId: string;
  status: TransactionDto['status'];
  handoverConfirmedAt: Date | null;
  returnRequestedAt: Date | null;
  returnConfirmedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}
interface Ctx {
  startDate: Date;
  endDate: Date;
  ownerId: string;
  item: ItemBrief;
  borrower: UserBrief;
  owner: UserBrief;
}

export function buildTransactionDto(tx: TxCore, ctx: Ctx, viewerId: string, reviewed: boolean): TransactionDto {
  const isOwner = ctx.ownerId === viewerId;
  return {
    id: tx.id,
    requestId: tx.requestId,
    status: tx.status,
    handoverConfirmedAt: tx.handoverConfirmedAt ? iso(tx.handoverConfirmedAt) : null,
    returnRequestedAt: tx.returnRequestedAt ? iso(tx.returnRequestedAt) : null,
    returnConfirmedAt: tx.returnConfirmedAt ? iso(tx.returnConfirmedAt) : null,
    completedAt: tx.completedAt ? iso(tx.completedAt) : null,
    createdAt: iso(tx.createdAt),
    startDate: day(ctx.startDate),
    endDate: day(ctx.endDate),
    item: toItemBrief(ctx.item),
    borrower: ctx.borrower,
    owner: ctx.owner,
    // Only the two parties of an approved request ever receive pickup details.
    pickupInstructions: ctx.item.pickupInstructions || null,
    myReviewSubmitted: reviewed,
    role: isOwner ? 'OWNER' : 'BORROWER',
  };
}

export const txInclude = (viewerId: string) =>
  ({
    request: {
      include: {
        item: { select: itemBriefSelect },
        borrower: { select: briefUserSelect },
        owner: { select: briefUserSelect },
      },
    },
    reviews: { where: { reviewerId: viewerId }, select: { id: true } },
  }) satisfies Prisma.TransactionInclude;

export type TxRow = Prisma.TransactionGetPayload<{ include: ReturnType<typeof txInclude> }>;

export function toTransactionDto(row: TxRow, viewerId: string): TransactionDto {
  return buildTransactionDto(
    row,
    {
      startDate: row.request.startDate,
      endDate: row.request.endDate,
      ownerId: row.request.ownerId,
      item: row.request.item,
      borrower: row.request.borrower,
      owner: row.request.owner,
    },
    viewerId,
    row.reviews.length > 0,
  );
}
