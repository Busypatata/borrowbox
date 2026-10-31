export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CSRF_INVALID'
  | 'EMAIL_NOT_VERIFIED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BOOKING_CONFLICT'
  | 'INVALID_STATE'
  | 'INVALID_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA'
  | 'STORAGE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (fields: Record<string, string>, message = 'Please check the submitted information.') =>
    new AppError(422, 'VALIDATION_ERROR', message, fields),
  badRequest: (message: string) => new AppError(400, 'BAD_REQUEST', message),
  unauthenticated: (message = 'Please sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message),
  notVerified: () =>
    new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email address before doing this.'),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  bookingConflict: (message = 'This item is already booked for some of those dates.') =>
    new AppError(409, 'BOOKING_CONFLICT', message),
  invalidState: (message: string) => new AppError(409, 'INVALID_STATE', message),
  invalidToken: () =>
    new AppError(400, 'INVALID_TOKEN', 'This link is invalid or has expired. Please request a new one.'),
};

/** Detects Postgres exclusion-constraint violations surfaced through Prisma / pg. */
export function isExclusionViolation(e: unknown): boolean {
  const text = e instanceof Error ? `${e.message} ${JSON.stringify((e as { meta?: unknown }).meta ?? '')}` : String(e);
  return text.includes('no_overlapping_approved') || text.includes('23P01');
}

export function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === 'P2002' || String((e as Error | null)?.message ?? '').includes('23505');
}
