import { Router } from 'express';
import multer from 'multer';
import { LIMITS, createItemSchema, itemQuerySchema, paginationSchema, updateItemSchema } from '@borrowbox/shared';
import { me, requireAuth, requireVerified } from '../../middleware/auth';
import { limits } from '../../middleware/rateLimit';
import { created, noContent, ok, pageMeta, parse, uuidParam } from '../../utils/http';
import * as svc from './item.service';

export const itemRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.MAX_IMAGE_BYTES, files: LIMITS.MAX_IMAGES },
});

itemRouter.get('/', async (req, res) => {
  const query = parse(itemQuerySchema, req.query);
  const { data, total } = await svc.listItems(query, req.auth?.user.id);
  ok(res, data, pageMeta(query.page, query.pageSize, total));
});

// Must be registered before "/:itemId".
itemRouter.get('/mine', requireAuth, async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const { data, total } = await svc.listMine(me(req).id, { q, status, page, pageSize });
  ok(res, data, pageMeta(page, pageSize, total));
});

itemRouter.post('/', requireVerified, async (req, res) => {
  const input = parse(createItemSchema, req.body);
  created(res, await svc.createItem(me(req).id, input));
});

itemRouter.get('/:itemId', async (req, res) => {
  ok(res, await svc.getItem(uuidParam(req, 'itemId'), req.auth?.user.id));
});

itemRouter.get('/:itemId/similar', async (req, res) => {
  ok(res, await svc.similarItems(uuidParam(req, 'itemId'), req.auth?.user.id));
});

itemRouter.patch('/:itemId', requireAuth, async (req, res) => {
  const input = parse(updateItemSchema, req.body);
  ok(res, await svc.updateItem(uuidParam(req, 'itemId'), me(req).id, input));
});

// Archive (soft delete — history is preserved).
itemRouter.delete('/:itemId', requireAuth, async (req, res) => {
  await svc.archiveItem(uuidParam(req, 'itemId'), me(req).id);
  noContent(res);
});

itemRouter.post('/:itemId/reactivate', requireAuth, async (req, res) => {
  await svc.reactivateItem(uuidParam(req, 'itemId'), me(req).id);
  ok(res, await svc.getItem(uuidParam(req, 'itemId'), me(req).id));
});

itemRouter.post('/:itemId/images', requireAuth, limits.uploads, upload.array('images', LIMITS.MAX_IMAGES), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  created(res, await svc.addImages(uuidParam(req, 'itemId'), me(req).id, files));
});

itemRouter.delete('/:itemId/images/:imageId', requireAuth, async (req, res) => {
  ok(res, await svc.removeImage(uuidParam(req, 'itemId'), uuidParam(req, 'imageId'), me(req).id));
});
