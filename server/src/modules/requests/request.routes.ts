import { Router } from 'express';
import { z } from 'zod';
import {
  REQUEST_STATUSES,
  cancelRequestSchema,
  createRequestSchema,
  declineRequestSchema,
  paginationSchema,
} from '@borrowbox/shared';
import type { RequestStatus } from '@prisma/client';
import { me, requireAuth, requireVerified } from '../../middleware/auth';
import { created, ok, pageMeta, parse, uuidParam } from '../../utils/http';
import * as svc from './request.service';

export const requestRouter = Router();
requestRouter.use(requireAuth);

const listQuery = paginationSchema.extend({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim().toUpperCase()) : undefined))
    .pipe(z.array(z.enum(REQUEST_STATUSES)).optional()),
});

requestRouter.post('/', requireVerified, async (req, res) => {
  const input = parse(createRequestSchema, req.body);
  created(res, await svc.createRequest(me(req).id, input));
});

for (const side of ['incoming', 'outgoing'] as const) {
  requestRouter.get(`/${side}`, async (req, res) => {
    const q = parse(listQuery, req.query);
    const { data, total } = await svc.listRequests(me(req).id, side, {
      statuses: q.status as RequestStatus[] | undefined,
      page: q.page,
      pageSize: q.pageSize,
    });
    ok(res, data, pageMeta(q.page, q.pageSize, total));
  });
}

requestRouter.get('/:requestId', async (req, res) => ok(res, await svc.getRequestDto(uuidParam(req, 'requestId'), me(req).id)));

requestRouter.post('/:requestId/approve', async (req, res) =>
  ok(res, await svc.approveRequest(uuidParam(req, 'requestId'), me(req).id)),
);
requestRouter.post('/:requestId/decline', async (req, res) => {
  const { reason } = parse(declineRequestSchema, req.body ?? {});
  ok(res, await svc.declineRequest(uuidParam(req, 'requestId'), me(req).id, reason));
});
requestRouter.post('/:requestId/cancel', async (req, res) => {
  const { reason } = parse(cancelRequestSchema, req.body ?? {});
  ok(res, await svc.cancelRequest(uuidParam(req, 'requestId'), me(req).id, reason));
});
