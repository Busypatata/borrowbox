import type { NotificationType } from '@prisma/client';
import { prisma, type Db } from '../config/prisma';
import { emails, sendEmail } from './email.service';

export interface NotifyInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  /** Unique key so retried mutations never create duplicates. */
  dedupeKey?: string;
}

import { shouldNotify } from '../utils/notificationRules';

/**
 * Creates an in-app notification using the provided db/transaction client, so it commits or
 * rolls back together with the state change that caused it. Returns the id, or null if
 * skipped (preferences) or already created (dedupe key).
 */
export async function notify(db: Db, input: NotifyInput): Promise<string | null> {
  const prefs = await db.notificationPreference.findUnique({ where: { userId: input.recipientId } });
  if (!shouldNotify(input.type, prefs)) return null;

  if (input.dedupeKey) {
    const existing = await db.notification.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
    if (existing) return null;
  }
  try {
    const row = await db.notification.create({
      data: {
        recipientId: input.recipientId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        dedupeKey: input.dedupeKey ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return null; // lost a dedupe race
    throw err;
  }
}

/** Best-effort email copy of an in-app notification. Call AFTER the transaction commits. */
export function emailNotificationLater(recipientId: string, title: string, body: string, type: NotificationType) {
  if (type === 'NEW_MESSAGE') return; // too noisy for email
  void (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { email: true, name: true, accountStatus: true, notificationPref: { select: { emailEnabled: true } } },
      });
      if (!user || user.accountStatus !== 'ACTIVE') return;
      if (type !== 'SECURITY' && user.notificationPref?.emailEnabled === false) return;
      await sendEmail(emails.notification(user.email, user.name, title, body));
    } catch {
      /* never break callers */
    }
  })();
}
