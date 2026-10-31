import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { ok } from '../../utils/http';

export const categoryRouter = Router();

categoryRouter.get('/', async (_req, res) => {
  const rows = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  ok(res, rows.map((c) => ({ slug: c.slug, label: c.label })));
});
