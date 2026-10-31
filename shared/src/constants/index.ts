export const CATEGORIES = [
  { slug: 'books-study', label: 'Books & Study' },
  { slug: 'electronics', label: 'Electronics' },
  { slug: 'tools-diy', label: 'Tools & DIY' },
  { slug: 'kitchen', label: 'Kitchen' },
  { slug: 'sports-fitness', label: 'Sports & Fitness' },
  { slug: 'outdoor-camping', label: 'Outdoor & Camping' },
  { slug: 'games-entertainment', label: 'Games & Entertainment' },
  { slug: 'home-garden', label: 'Home & Garden' },
  { slug: 'other', label: 'Other' },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];

export const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'] as const;
export type Condition = (typeof CONDITIONS)[number];
export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
};

export const ITEM_STATUSES = ['AVAILABLE', 'UNAVAILABLE', 'ARCHIVED', 'HIDDEN'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'CANCELLED', 'COMPLETED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const TRANSACTION_STATUSES = [
  'AWAITING_HANDOVER',
  'BORROWED',
  'RETURN_REQUESTED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'REQUEST_RECEIVED',
  'REQUEST_APPROVED',
  'REQUEST_DECLINED',
  'REQUEST_CANCELLED',
  'NEW_MESSAGE',
  'HANDOVER_CONFIRMED',
  'RETURN_REQUESTED',
  'RETURN_CONFIRMED',
  'NEW_REVIEW',
  'SECURITY',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REPORT_REASONS = [
  'SPAM_OR_MISLEADING',
  'INAPPROPRIATE_CONTENT',
  'SUSPICIOUS_BEHAVIOUR',
  'SAFETY_CONCERN',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM_OR_MISLEADING: 'Spam or misleading listing',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  SUSPICIOUS_BEHAVIOUR: 'Suspicious behaviour',
  SAFETY_CONCERN: 'Safety concern',
  OTHER: 'Other',
};

export const LIMITS = {
  TITLE_MIN: 3,
  TITLE_MAX: 100,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 2000,
  MAX_IMAGES: 5,
  MAX_IMAGE_BYTES: 5 * 1024 * 1024,
  MESSAGE_MAX: 2000,
  REVIEW_MAX: 1000,
  BIO_MAX: 500,
  MAX_BOOKING_DAYS: 30,
  PAGE_SIZE_DEFAULT: 12,
  PAGE_SIZE_MAX: 48,
  PASSWORD_MIN: 10,
} as const;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Application-wide timezone policy for date-only booking values. */
export const APP_TIMEZONE = 'UTC';
