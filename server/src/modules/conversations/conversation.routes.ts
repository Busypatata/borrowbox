import { Router } from 'express';
import { z } from 'zod';
import { createConversationSchema, paginationSchema, sendMessageSchema } from '@borrowbox/shared';
import { me, requireAuth } from '../../middleware/auth';
import { limits } from '../../middleware/rateLimit';
import { created, noContent, ok, pageMeta, parse, uuidParam } from '../../utils/http';
import * as svc from './conversation.service';

export const conversationRouter = Router();
conversationRouter.use(requireAuth);

conversationRouter.get('/', async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  const { data, total } = await svc.listConversations(me(req).id, page, pageSize);
  ok(res, data, pageMeta(page, pageSize, total));
});

conversationRouter.get('/unread-count', async (req, res) => {
  const count = await svc.unreadMessageCount(me(req).id);
  ok(res, { count });
});

conversationRouter.post('/', limits.messages, async (req, res) => {
  const input = parse(createConversationSchema, req.body);
  created(res, await svc.createOrGetConversation(me(req).id, input));
});

conversationRouter.get('/:conversationId', async (req, res) =>
  ok(res, await svc.getConversation(uuidParam(req, 'conversationId'), me(req).id)),
);

conversationRouter.get('/:conversationId/messages', async (req, res) => {
  const q = parse(
    z.object({
      before: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).optional().default(30),
    }),
    req.query,
  );
  const { messages, hasMore, nextCursor } = await svc.listMessages(uuidParam(req, 'conversationId'), me(req).id, q);
  ok(res, messages, { hasMore, nextCursor });
});

conversationRouter.post('/:conversationId/messages', limits.messages, async (req, res) => {
  const { body, clientId } = parse(sendMessageSchema, req.body);
  created(res, await svc.sendMessage(uuidParam(req, 'conversationId'), me(req).id, body, clientId));
});

conversationRouter.post('/:conversationId/read', async (req, res) => {
  await svc.markRead(uuidParam(req, 'conversationId'), me(req).id);
  noContent(res);
});
