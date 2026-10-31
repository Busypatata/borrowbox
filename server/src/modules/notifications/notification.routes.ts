import { Router } from 'express';
import type { NotificationDto } from '@borrowbox/shared';
import { paginationSchema } from '@borrowbox/shared';
import { prisma } from '../../config/prisma';
import { me, requireAuth } from '../../middleware/auth';
import { Errors } from '../../utils/errors';
import { noContent, ok, pageMeta, parse, uuidParam } from '../../utils/http';

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

const toDto = (n: {
  id: string; type: NotificationDto['type']; title: string; body: string;
  entityType: string | null; entityId: string | null; readAt: Date | null; createdAt: Date;
}): NotificationDto => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  entityType: n.entityType,
  entityId: n.entityId,
  readAt: n.readAt?.toISOString() ?? null,
  createdAt: n.createdAt.toISOString(),
});

notificationRouter.get('/', async (req, res) => {
  const userId = me(req).id;
  const { page, pageSize } = parse(paginationSchema, req.query);
  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { recipientId: userId } }),
    prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
  ]);
  ok(res, rows.map(toDto), { ...pageMeta(page, pageSize, total), unread });
});

notificationRouter.get('/unread-count', async (req, res) => {
  ok(res, { count: await prisma.notification.count({ where: { recipientId: me(req).id, readAt: null } }) });
});

notificationRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { recipientId: me(req).id, readAt: null }, data: { readAt: new Date() } });
  noContent(res);
});

notificationRouter.post('/:notificationId/read', async (req, res) => {
  const id = uuidParam(req, 'notificationId');
  const userId = me(req).id;
  // Scoped by recipient: another user's notification looks like "not found". Idempotent for repeats.
  const n = await prisma.notification.findFirst({ where: { id, recipientId: userId } });
  if (!n) throw Errors.notFound('Notification');
  if (!n.readAt) await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  ok(res, toDto({ ...n, readAt: n.readAt ?? new Date() }));
});
