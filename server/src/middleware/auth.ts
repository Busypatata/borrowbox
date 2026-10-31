import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { hashSessionToken } from '../utils/crypto';
import { Errors } from '../utils/errors';

export const SESSION_COOKIE = 'bb_sid';
const TOUCH_INTERVAL_MS = 5 * 60_000;

/** Loads the session (if any) from the HTTP-only cookie and attaches `req.auth`. */
export async function attachAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const raw = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!raw || typeof raw !== 'string' || raw.length > 200) return next();

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(raw) },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true, accountStatus: true },
        },
      },
    });
    if (!session) return next();

    if (session.expiresAt.getTime() <= Date.now() || session.user.accountStatus !== 'ACTIVE') {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return next();
    }

    if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }

    const { accountStatus: _status, ...user } = session.user;
    req.auth = { user, sessionId: session.id, csrfToken: session.csrfToken };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(Errors.unauthenticated());
  next();
}

export function requireVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(Errors.unauthenticated());
  if (!req.auth.user.emailVerifiedAt) return next(Errors.notVerified());
  next();
}

/** Role comes from the database row loaded server-side — never from the client. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(Errors.unauthenticated());
  if (req.auth.user.role !== 'ADMIN') return next(Errors.forbidden());
  next();
}

export function me(req: Request) {
  if (!req.auth) throw Errors.unauthenticated();
  return req.auth.user;
}

export function cookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: env.isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  } as const;
}
