import { Router } from 'express';
import { z } from 'zod';
import { TRANSACTION_STATUSES, createReviewSchema, paginationSchema, type TxAction } from '@borrowbox/shared';
import type { TransactionStatus } from '@prisma/client';
import { me, requireAuth, requireVerified } from '../../middleware/auth';
import { created, ok, pageMeta, parse, uuidParam } from '../../utils/http';
import * as svc from './transaction.service';
import { createReview } from '../reviews/review.service';

export const transactionRouter = Router();
transactionRouter.use(requireAuth);

const listQuery = paginationSchema.extend({
  role: z.enum(['OWNER', 'BORROWER']).optional(),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim().toUpperCase()) : undefined))
    .pipe(z.array(z.enum(TRANSACTION_STATUSES)).optional()),
});

transactionRouter.get('/', async (req, res) => {
  const q = parse(listQuery, req.query);
  const { data, total } = await svc.listTransactions(me(req).id, {
    statuses: q.status as TransactionStatus[] | undefined,
    role: q.role,
    page: q.page,
    pageSize: q.pageSize,
  });
  ok(res, data, pageMeta(q.page, q.pageSize, total));
});

transactionRouter.get('/:transactionId', async (req, res) =>
  ok(res, await svc.getTransaction(uuidParam(req, 'transactionId'), me(req).id)),
);

for (const action of ['confirm-handover', 'request-return', 'confirm-return'] as TxAction[]) {
  transactionRouter.post(`/:transactionId/${action}`, async (req, res) =>
    ok(res, await svc.performAction(uuidParam(req, 'transactionId'), me(req).id, action)),
  );
}

transactionRouter.post('/:transactionId/reviews', requireVerified, async (req, res) => {
  const input = parse(createReviewSchema, req.body);
  created(res, await createReview(uuidParam(req, 'transactionId'), me(req).id, input));
});
