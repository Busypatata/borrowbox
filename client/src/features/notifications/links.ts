import type { NotificationDto } from '@borrowbox/shared';

/** Where a notification should take the user. */
export function notificationHref(n: Pick<NotificationDto, 'type' | 'entityType' | 'entityId'>): string {
  if (!n.entityType || !n.entityId) return '/notifications';
  switch (n.entityType) {
    case 'request':
      return n.type === 'REQUEST_RECEIVED' || n.type === 'REQUEST_CANCELLED' ? '/requests/incoming' : '/requests/outgoing';
    case 'transaction':
      return n.type === 'RETURN_REQUESTED' ? '/lending' : '/borrowings';
    case 'conversation':
      return `/messages/${n.entityId}`;
    case 'item':
      return `/items/${n.entityId}`;
    case 'user':
      return '/profile';
    default:
      return '/notifications';
  }
}
