import { Router } from 'express';
import { z } from 'zod';
import { createReportSchema, paginationSchema, resolveReportSchema } from '@borrowbox/shared';
import { me, requireAdmin, requireAuth } from '../../middleware/auth';
import { limits } from '../../middleware/rateLimit';
import { created, noContent, ok, pageMeta, parse, uuidParam } from '../../utils/http';
import * as svc from './report.service';

export const reportRouter = Router();
reportRouter.post('/', requireAuth, limits.reports, async (req, res) => {
  const input = parse(createReportSchema, req.body);
  created(res, await svc.createReport(me(req).id, input));
});

/** Moderation API — every route is guarded by a server-side role check. */
export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get('/reports', async (req, res) => {
  const q = parse(paginationSchema.extend({ status: z.string().optional() }), req.query);
  const { data, total } = await svc.adminListReports(q);
  ok(res, data, pageMeta(q.page, q.pageSize, total));
});
adminRouter.get('/reports/:reportId', async (req, res) => ok(res, await svc.adminGetReport(uuidParam(req, 'reportId'))));
adminRouter.post('/reports/:reportId/resolve', async (req, res) => {
  const input = parse(resolveReportSchema, req.body);
  await svc.adminResolveReport(me(req).id, uuidParam(req, 'reportId'), input);
  noContent(res);
});
adminRouter.post('/items/:itemId/hide', async (req, res) => {
  await svc.adminSetItemVisibility(me(req).id, uuidParam(req, 'itemId'), true, typeof req.body?.note === 'string' ? req.body.note : undefined);
  noContent(res);
});
adminRouter.post('/items/:itemId/restore', async (req, res) => {
  await svc.adminSetItemVisibility(me(req).id, uuidParam(req, 'itemId'), false, typeof req.body?.note === 'string' ? req.body.note : undefined);
  noContent(res);
});
