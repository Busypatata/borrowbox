import { Router } from 'express';
import multer from 'multer';
import {
  deleteAccountSchema,
  notificationPrefsSchema,
  paginationSchema,
  updateProfileSchema,
} from '@borrowbox/shared';
import { limits } from '../../middleware/rateLimit';
import { LIMITS } from '@borrowbox/shared';
import { Errors } from '../../utils/errors';
import { SESSION_COOKIE, cookieOptions, me, requireAuth } from '../../middleware/auth';
import { noContent, ok, pageMeta, parse, uuidParam } from '../../utils/http';
import { toPublicUser } from './user.mapper';
import * as svc from './user.service';
import { listReviewsFor } from '../reviews/review.service';

export const userRouter = Router();
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITS.MAX_IMAGE_BYTES, files: 1 } });

// Static "me" routes first so ":userId" never captures them.
userRouter.get('/me/stats', requireAuth, async (req, res) => ok(res, await svc.dashboardStats(me(req).id)));

userRouter.get('/me/notification-preferences', requireAuth, async (req, res) =>
  ok(res, await svc.getNotificationPrefs(me(req).id)),
);
userRouter.patch('/me/notification-preferences', requireAuth, async (req, res) => {
  const input = parse(notificationPrefsSchema, req.body);
  ok(res, await svc.updateNotificationPrefs(me(req).id, input));
});

userRouter.patch('/me', requireAuth, async (req, res) => {
  const input = parse(updateProfileSchema, req.body);
  ok(res, await svc.updateProfile(me(req).id, input));
});

userRouter.post('/me/avatar', requireAuth, limits.uploads, avatarUpload.single('image'), async (req, res) => {
  if (!req.file) throw Errors.badRequest('Choose an image to upload.');
  ok(res, await svc.setAvatar(me(req).id, req.file));
});
userRouter.delete('/me/avatar', requireAuth, async (req, res) => ok(res, await svc.removeAvatar(me(req).id)));

userRouter.delete('/me', requireAuth, async (req, res) => {
  const { password } = parse(deleteAccountSchema, req.body);
  await svc.deleteAccount(me(req).id, password);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  noContent(res);
});

userRouter.get('/:userId', async (req, res) => ok(res, await toPublicUser(uuidParam(req, 'userId'))));

userRouter.get('/:userId/reviews', async (req, res) => {
  const { page, pageSize } = parse(paginationSchema, req.query);
  const { rows, total } = await listReviewsFor(uuidParam(req, 'userId'), page, pageSize);
  ok(res, rows, pageMeta(page, pageSize, total));
});
