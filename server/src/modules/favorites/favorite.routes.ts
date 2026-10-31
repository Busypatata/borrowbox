import { Router } from 'express';
import { paginationSchema } from '@borrowbox/shared';
import { prisma } from '../../config/prisma';
import { me, requireAuth } from '../../middleware/auth';
import { Errors } from '../../utils/errors';
import { noContent, ok, pageMeta, parse, uuidParam } from '../../utils/http';
import { itemInclude, toSummary } from '../items/item.mapper';

export const favoriteRouter = Router();
favoriteRouter.use(requireAuth);

favoriteRouter.get('/', async (req, res) => {
  const userId = me(req).id;
  const { page, pageSize } = parse(paginationSchema, req.query);
  const where = { userId, item: { status: { in: ['AVAILABLE', 'UNAVAILABLE'] as ('AVAILABLE' | 'UNAVAILABLE')[] }, owner: { accountStatus: 'ACTIVE' as const } } };
  const [rows, total] = await Promise.all([
    prisma.favorite.findMany({
      where,
      include: { item: { include: itemInclude(userId) } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.favorite.count({ where }),
  ]);
  ok(res, rows.map((f) => toSummary(f.item as never, null)), pageMeta(page, pageSize, total));
});

favoriteRouter.post('/:itemId', async (req, res) => {
  const userId = me(req).id;
  const itemId = uuidParam(req, 'itemId');
  const item = await prisma.item.findFirst({
    where: { id: itemId, status: { in: ['AVAILABLE', 'UNAVAILABLE'] }, owner: { accountStatus: 'ACTIVE' } },
    select: { id: true },
  });
  if (!item) throw Errors.notFound('Item');
  await prisma.favorite.upsert({ where: { userId_itemId: { userId, itemId } }, update: {}, create: { userId, itemId } });
  ok(res, { itemId, favorited: true }, undefined, 201);
});

favoriteRouter.delete('/:itemId', async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: me(req).id, itemId: uuidParam(req, 'itemId') } });
  noContent(res);
});
