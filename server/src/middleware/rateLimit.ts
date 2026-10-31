import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env';

function limiter(opts: { windowMs: number; max: number; keyByUser?: boolean; message: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.isTest && Boolean(env.DISABLE_RATE_LIMIT),
    keyGenerator: (req: Request) =>
      opts.keyByUser && req.auth ? `u:${req.auth.user.id}` : (req.ip ?? 'unknown'),
    handler: (_req, res) => {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: opts.message } });
    },
  });
}

const MIN = 60_000;
export const limits = {
  global: limiter({ windowMs: MIN, max: 300, message: 'Too many requests. Please slow down.' }),
  login: limiter({ windowMs: 15 * MIN, max: 10, message: 'Too many sign-in attempts. Try again in a few minutes.' }),
  register: limiter({ windowMs: 60 * MIN, max: 10, message: 'Too many sign-up attempts. Please try again later.' }),
  passwordReset: limiter({ windowMs: 60 * MIN, max: 5, message: 'Too many reset requests. Please try again later.' }),
  verification: limiter({ windowMs: 60 * MIN, max: 5, message: 'Too many verification attempts. Please try again later.' }),
  resend: limiter({ windowMs: 60 * MIN, max: 3, keyByUser: true, message: 'Verification email was sent recently. Please wait before requesting another.' }),
  messages: limiter({ windowMs: MIN, max: 60, keyByUser: true, message: 'You are sending messages too quickly.' }),
  reports: limiter({ windowMs: 60 * MIN, max: 10, keyByUser: true, message: 'Too many reports submitted. Please try again later.' }),
  uploads: limiter({ windowMs: 10 * MIN, max: 30, keyByUser: true, message: 'Too many uploads. Please try again later.' }),
};
