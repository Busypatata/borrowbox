import { LIMITS, type RequestStatus, type TransactionStatus } from './constants/index';

/** Pure business rules shared by server (authoritative) and client (UX hints). */

export const MS_PER_DAY = 86_400_000;

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type DateRangeError =
  | 'END_BEFORE_START'
  | 'START_IN_PAST'
  | 'TOO_LONG';

export function validateDateRange(
  start: string,
  end: string,
  now: Date = new Date(),
  maxDays: number = LIMITS.MAX_BOOKING_DAYS,
): DateRangeError | null {
  const s = parseDateOnly(start).getTime();
  const e = parseDateOnly(end).getTime();
  if (e < s) return 'END_BEFORE_START';
  if (start < todayUtc(now)) return 'START_IN_PAST';
  const days = Math.round((e - s) / MS_PER_DAY) + 1;
  if (days > maxDays) return 'TOO_LONG';
  return null;
}

export const DATE_RANGE_MESSAGES: Record<DateRangeError, string> = {
  END_BEFORE_START: 'End date must be on or after the start date.',
  START_IN_PAST: 'Start date cannot be in the past.',
  TOO_LONG: `Bookings can be at most ${LIMITS.MAX_BOOKING_DAYS} days.`,
};

/** Inclusive date ranges overlap test (date-only strings). */
export function rangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  PENDING: ['APPROVED', 'DECLINED', 'CANCELLED'],
  APPROVED: ['COMPLETED'],
  DECLINED: [],
  CANCELLED: [],
  COMPLETED: [],
};
export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[from].includes(to);
}

const TX_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  AWAITING_HANDOVER: ['BORROWED', 'CANCELLED'],
  BORROWED: ['RETURN_REQUESTED', 'COMPLETED'],
  RETURN_REQUESTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};
export function canTransitionTransaction(from: TransactionStatus, to: TransactionStatus): boolean {
  return TX_TRANSITIONS[from].includes(to);
}

export type TxAction = 'confirm-handover' | 'request-return' | 'confirm-return';
export type TxRole = 'OWNER' | 'BORROWER';

/** Which role may perform which action, and from which status. */
export const TX_ACTIONS: Record<TxAction, { role: TxRole; from: TransactionStatus[]; to: TransactionStatus }> = {
  'confirm-handover': { role: 'OWNER', from: ['AWAITING_HANDOVER'], to: 'BORROWED' },
  'request-return': { role: 'BORROWER', from: ['BORROWED'], to: 'RETURN_REQUESTED' },
  // Owner may confirm return directly from BORROWED (borrower may forget to request it).
  'confirm-return': { role: 'OWNER', from: ['BORROWED', 'RETURN_REQUESTED'], to: 'COMPLETED' },
};

export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

/** Haversine distance in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}
