import type { NotificationType } from '@prisma/client';

export type PrefKey = 'requestUpdates' | 'messages' | 'reviews';
const PREF_FOR: Partial<Record<NotificationType, PrefKey>> = {
  REQUEST_RECEIVED: 'requestUpdates',
  REQUEST_APPROVED: 'requestUpdates',
  REQUEST_DECLINED: 'requestUpdates',
  REQUEST_CANCELLED: 'requestUpdates',
  HANDOVER_CONFIRMED: 'requestUpdates',
  RETURN_REQUESTED: 'requestUpdates',
  RETURN_CONFIRMED: 'requestUpdates',
  NEW_MESSAGE: 'messages',
  NEW_REVIEW: 'reviews',
  // SECURITY is intentionally absent: it can never be disabled.
};

/** Pure helper — unit tested. */
export function shouldNotify(
  type: NotificationType,
  prefs: Partial<Record<PrefKey, boolean>> | null | undefined,
): boolean {
  const key = PREF_FOR[type];
  if (!key) return true;
  return prefs?.[key] ?? true;
}

