import type { CreateReviewInput, ReviewDto } from '@borrowbox/shared';
import { prisma } from '../../config/prisma';
import { Errors, isUniqueViolation } from '../../utils/errors';
import { emailNotificationLater, notify } from '../../services/notification.service';

const reviewerSelect = { id: true, name: true, profileImageUrl: true } as const;

export async function createReview(transactionId: string, reviewerId: string, input: CreateReviewInput): Promise<ReviewDto> {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { request: { select: { ownerId: true, borrowerId: true, item: { select: { title: true } } } } },
  });
  if (!tx || (tx.request.ownerId !== reviewerId && tx.request.borrowerId !== reviewerId)) {
    throw Errors.notFound('Transaction');
  }
  if (tx.status !== 'COMPLETED') throw Errors.invalidState('You can review once the borrowing is completed.');

  const reviewedUserId = tx.request.ownerId === reviewerId ? tx.request.borrowerId : tx.request.ownerId;
  if (reviewedUserId === reviewerId) throw Errors.forbidden("You can't review yourself.");

  let review;
  try {
    review = await prisma.$transaction(async (db) => {
      const r = await db.review.create({
        data: { transactionId, reviewerId, reviewedUserId, rating: input.rating, comment: input.comment || null },
        include: { reviewer: { select: reviewerSelect } },
      });
      await notify(db, {
        recipientId: reviewedUserId,
        type: 'NEW_REVIEW',
        title: 'You received a review',
        body: `${r.reviewer.name} rated you ${input.rating}/5 for "${tx.request.item.title}".`,
        entityType: 'user',
        entityId: reviewedUserId,
        dedupeKey: `review:${transactionId}:${reviewerId}`,
      });
      return r;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw Errors.conflict('You already reviewed this borrowing.');
    throw err;
  }
  emailNotificationLater(reviewedUserId, 'You received a review', `${review.reviewer.name} left you a ${input.rating}/5 review.`, 'NEW_REVIEW');
  return { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt.toISOString(), reviewer: review.reviewer };
}

export async function listReviewsFor(userId: string, page: number, pageSize: number) {
  const user = await prisma.user.findFirst({ where: { id: userId, accountStatus: 'ACTIVE' }, select: { id: true } });
  if (!user) throw Errors.notFound('User');
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where: { reviewedUserId: userId },
      include: { reviewer: { select: reviewerSelect } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where: { reviewedUserId: userId } }),
  ]);
  const data: ReviewDto[] = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    reviewer: r.reviewer,
  }));
  return { rows: data, total };
}
