import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@borrowbox/shared';
import { z } from 'zod';
import { SESSION_COOKIE, cookieOptions, me, requireAuth } from '../../middleware/auth';
import { limits } from '../../middleware/rateLimit';
import { noContent, ok, parse } from '../../utils/http';
import { toMe } from '../users/user.mapper';
import * as svc from './auth.service';

export const authRouter = Router();

const GENERIC = 'If that request can be completed, you will receive an email shortly.';

authRouter.post('/register', limits.register, async (req, res) => {
  const input = parse(registerSchema, req.body);
  await svc.register(input);
  ok(
    res,
    { message: 'Account created. Check your email for a verification link.' },
    undefined,
    202,
  );
});

authRouter.post('/login', limits.login, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const result = await svc.login(input, req.get('user-agent') ?? undefined);
  res.cookie(SESSION_COOKIE, result.rawToken, cookieOptions(result.persistent ? result.maxAgeMs : undefined));
  ok(res, { user: result.user, csrfToken: result.csrfToken });
});

authRouter.post('/logout', async (req, res) => {
  if (req.auth) await svc.logout(req.auth.sessionId);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  noContent(res);
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await svc.logoutAll(me(req).id);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  noContent(res);
});

authRouter.get('/me', async (req, res) => {
  if (!req.auth) return ok(res, { user: null, csrfToken: null });
  ok(res, { user: await toMe(req.auth.user.id), csrfToken: req.auth.csrfToken });
});

authRouter.post('/forgot-password', limits.passwordReset, async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body);
  await svc.forgotPassword(email);
  ok(res, { message: GENERIC });
});

authRouter.post('/reset-password', limits.passwordReset, async (req, res) => {
  const { token, password } = parse(resetPasswordSchema, req.body);
  await svc.resetPassword(token, password);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  ok(res, { message: 'Password updated. Please sign in with your new password.' });
});

authRouter.post('/verify-email', limits.verification, async (req, res) => {
  const { token } = parse(verifyEmailSchema, req.body);
  await svc.verifyEmail(token);
  ok(res, { message: 'Email verified. You are all set.' });
});

authRouter.post('/resend-verification', limits.resend, async (req, res) => {
  const { email } = parse(z.object({ email: z.string().email().optional() }), req.body ?? {});
  await svc.resendVerification({ userId: req.auth?.user.id, email });
  ok(res, { message: GENERIC });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  const user = me(req);
  await svc.changePassword(user.id, req.auth!.sessionId, currentPassword, newPassword);
  ok(res, { message: 'Password changed. Other devices were signed out.' });
});
