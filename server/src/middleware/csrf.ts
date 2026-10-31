import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { safeEqual } from '../utils/crypto';
import { AppError } from '../utils/errors';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigin(origin: string): boolean {
  try {
    return new URL(origin).origin === new URL(env.CLIENT_URL).origin;
  } catch {
    return false;
  }
}

/**
 * Defence in depth for cookie-authenticated, state-changing requests:
 *  1. If the browser sends an Origin header it must be our configured client.
 *  2. Authenticated requests must echo the per-session token in `X-CSRF-Token`.
 */
export function csrfProtect(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && !allowedOrigin(origin)) {
    return next(new AppError(403, 'CSRF_INVALID', 'Request origin is not allowed.'));
  }
  if (req.auth) {
    const header = req.get('x-csrf-token');
    if (!header || !safeEqual(header, req.auth.csrfToken)) {
      return next(new AppError(403, 'CSRF_INVALID', 'Your session security token is missing or invalid. Please refresh the page.'));
    }
  }
  next();
}
