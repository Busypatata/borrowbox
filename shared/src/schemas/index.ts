import { z } from 'zod';
import {
  CATEGORY_SLUGS,
  CONDITIONS,
  LIMITS,
  REPORT_REASONS,
} from '../constants/index';

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters`)
  .max(128, 'Password is too long')
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Use at least one letter and one number');

export const idSchema = z.string().uuid('Invalid identifier');

export const registerSchema = z
  .object({
    name: trimmed(2, 80, 'Name'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms and Privacy Policy' }),
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

export const updateProfileSchema = z.object({
  name: trimmed(2, 80, 'Name').optional(),
  bio: z.string().trim().max(LIMITS.BIO_MAX).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  community: z.string().trim().max(80).nullable().optional(),
  latitude: latitude.nullable().optional(),
  longitude: longitude.nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const notificationPrefsSchema = z.object({
  requestUpdates: z.boolean().optional(),
  messages: z.boolean().optional(),
  reviews: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required').max(128),
  confirm: z.literal('DELETE', { errorMap: () => ({ message: 'Type DELETE to confirm' }) }),
});

export const itemBaseSchema = z.object({
  title: trimmed(LIMITS.TITLE_MIN, LIMITS.TITLE_MAX, 'Title'),
  description: trimmed(LIMITS.DESCRIPTION_MIN, LIMITS.DESCRIPTION_MAX, 'Description'),
  category: z.enum(CATEGORY_SLUGS, { errorMap: () => ({ message: 'Choose a category' }) }),
  condition: z.enum(CONDITIONS, { errorMap: () => ({ message: 'Choose a condition' }) }),
  community: trimmed(2, 80, 'Community'),
  city: trimmed(2, 80, 'City'),
  latitude: latitude.nullable().optional(),
  longitude: longitude.nullable().optional(),
  pickupInstructions: z.string().trim().max(500).optional().default(''),
});
export const createItemSchema = itemBaseSchema;
export const updateItemSchema = itemBaseSchema.partial().extend({
  status: z.enum(['AVAILABLE', 'UNAVAILABLE']).optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Invalid date');

export const itemQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORY_SLUGS).optional(),
  condition: z.enum(CONDITIONS).optional(),
  community: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
  radiusKm: z.coerce.number().min(0.5).max(200).optional(),
  sort: z.enum(['newest', 'relevance', 'distance']).optional().default('newest'),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.PAGE_SIZE_MAX)
    .optional()
    .default(LIMITS.PAGE_SIZE_DEFAULT),
  ownerId: idSchema.optional(),
});
export type ItemQuery = z.infer<typeof itemQuerySchema>;

export const createRequestSchema = z.object({
  itemId: idSchema,
  startDate: dateOnly,
  endDate: dateOnly,
  message: z.string().trim().max(500).optional().default(''),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const declineRequestSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
export const cancelRequestSchema = declineRequestSchema;

export const createConversationSchema = z.object({
  recipientId: idSchema,
  itemId: idSchema.optional(),
  requestId: idSchema.optional(),
});
export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(LIMITS.MESSAGE_MAX, `Message must be at most ${LIMITS.MESSAGE_MAX} characters`),
  clientId: z.string().max(64).optional(),
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating').max(5),
  comment: z.string().trim().max(LIMITS.REVIEW_MAX).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const createReportSchema = z
  .object({
    itemId: idSchema.optional(),
    userId: idSchema.optional(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Boolean(v.itemId) !== Boolean(v.userId), {
    message: 'Report exactly one of an item or a user',
    path: ['itemId'],
  });

export const resolveReportSchema = z.object({
  status: z.enum(['REVIEWED', 'ACTIONED', 'DISMISSED']),
  note: z.string().trim().max(500).optional(),
  hideItem: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});
