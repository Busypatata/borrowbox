import crypto from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../config/env';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
/** Session cookie values are HMAC'd with SESSION_SECRET before they touch the database. */
export const hashSessionToken = (value: string) =>
  crypto.createHmac('sha256', env.SESSION_SECRET).update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => argon2.hash(plain, ARGON_OPTS);

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;
/** Burn comparable CPU time when the account does not exist (login timing equalisation). */
export async function fakePasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(await dummyHash, plain);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const MINUTES = 60_000;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;
