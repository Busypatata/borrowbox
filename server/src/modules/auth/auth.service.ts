import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import {
  DAYS,
  HOURS,
  MINUTES,
  fakePasswordCheck,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  randomToken,
  sha256,
  verifyPassword,
} from '../../utils/crypto';
import { AppError, Errors } from '../../utils/errors';
import { emails, sendEmail } from '../../services/email.service';
import { notify } from '../../services/notification.service';
import { toMe } from '../users/user.mapper';

const RESET_TTL = 30 * MINUTES;
const VERIFY_TTL = 24 * HOURS;
const SESSION_TTL_SHORT = 12 * HOURS; // session cookie, no "remember me"
const SESSION_TTL_LONG = 30 * DAYS; // "remember me"

export const sessionPolicy = { SESSION_TTL_SHORT, SESSION_TTL_LONG };

async function issueVerificationToken(userId: string): Promise<string> {
  const token = randomToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + VERIFY_TTL) },
    }),
  ]);
  return token;
}

/**
 * Registration never reveals whether an email is already in use: both outcomes return the same
 * response. Existing owners are told by email instead.
 */
export async function register(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.accountStatus === 'ACTIVE') {
      void sendEmail(emails.alreadyRegistered(existing.email, existing.name));
    }
    return;
  }
  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        notificationPref: { create: {} },
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return; // concurrent duplicate: same generic outcome
    throw err;
  }
  const token = await issueVerificationToken(user.id);
  void sendEmail(emails.verification(user.email, user.name, token));
}

export async function login(input: { email: string; password: string; rememberMe: boolean }, userAgent?: string) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.accountStatus !== 'ACTIVE') {
    await fakePasswordCheck(input.password);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');

  const session = await createSession(user.id, input.rememberMe, userAgent);
  return { ...session, user: await toMe(user.id) };
}

export async function createSession(userId: string, rememberMe: boolean, userAgent?: string) {
  const raw = randomToken(32);
  const ttl = rememberMe ? SESSION_TTL_LONG : SESSION_TTL_SHORT;
  const csrfToken = randomToken(24);
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(raw),
      csrfToken,
      userId,
      expiresAt: new Date(Date.now() + ttl),
      userAgent: userAgent?.slice(0, 200),
    },
  });
  // Opportunistic cleanup of expired sessions.
  void prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
  return { rawToken: raw, csrfToken, persistent: rememberMe, maxAgeMs: ttl };
}

export const logout = (sessionId: string) => prisma.session.deleteMany({ where: { id: sessionId } });
export const logoutAll = (userId: string) => prisma.session.deleteMany({ where: { userId } });

export async function verifyEmail(token: string) {
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) throw Errors.invalidToken();

  // Single-use: claim the token atomically.
  const claimed = await prisma.emailVerificationToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) throw Errors.invalidToken();
  await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
}

export async function resendVerification(opts: { userId?: string; email?: string }) {
  const user = opts.userId
    ? await prisma.user.findUnique({ where: { id: opts.userId } })
    : opts.email
      ? await prisma.user.findUnique({ where: { email: normalizeEmail(opts.email) } })
      : null;
  if (!user || user.accountStatus !== 'ACTIVE' || user.emailVerifiedAt) return; // generic outcome
  const token = await issueVerificationToken(user.id);
  void sendEmail(emails.verification(user.email, user.name, token));
}

export async function forgotPassword(emailRaw: string) {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(emailRaw) } });
  if (!user || user.accountStatus !== 'ACTIVE') return;
  const token = randomToken();
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL) },
    }),
  ]);
  void sendEmail(emails.passwordReset(user.email, user.name, token));
}

export async function resetPassword(token: string, newPassword: string) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now() || row.user.accountStatus !== 'ACTIVE') {
    throw Errors.invalidToken();
  }
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw Errors.invalidToken();
    await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.user.update({
      where: { id: row.userId },
      // Receiving the reset email proves control of the address.
      data: { passwordHash, emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() },
    });
    await tx.session.deleteMany({ where: { userId: row.userId } }); // policy: reset signs out everywhere
    await notify(tx, {
      recipientId: row.userId,
      type: 'SECURITY',
      title: 'Your password was reset',
      body: 'Your password was changed using a reset link. All devices were signed out.',
    });
  });
  void sendEmail(emails.security(row.user.email, row.user.name, 'Your BorrowBox password was just reset.'));
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.unauthenticated();
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw Errors.validation({ currentPassword: 'Current password is incorrect.' });
  }
  if (await verifyPassword(user.passwordHash, newPassword)) {
    throw Errors.validation({ newPassword: 'Choose a password different from your current one.' });
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    // Policy: every OTHER session is invalidated; the current one stays signed in.
    await tx.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
    await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await notify(tx, {
      recipientId: userId,
      type: 'SECURITY',
      title: 'Password changed',
      body: 'Your password was changed. Other devices were signed out.',
    });
  });
  void sendEmail(emails.security(user.email, user.name, 'Your BorrowBox password was just changed.'));
}

export const authConfig = { rememberDays: SESSION_TTL_LONG / DAYS, env: env.NODE_ENV };
