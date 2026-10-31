import type { NotificationDto } from '@borrowbox/shared';
import { api } from './client';

export const notificationsApi = {
  list: (page = 1) => api.getPage<NotificationDto[]>('/notifications', { page, pageSize: 20 }),
  unread: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.post<NotificationDto>(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};
