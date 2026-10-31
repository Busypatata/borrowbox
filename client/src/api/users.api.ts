import type { Me, PublicUser, ReviewDto, UpdateProfileInput } from '@borrowbox/shared';
import { api } from './client';

export interface DashboardStats {
  incomingPending: number;
  outgoingPending: number;
  activeBorrowings: number;
  activeLending: number;
  itemsListed: number;
  unreadNotifications: number;
  unreadMessages: number;
}
export interface Prefs {
  requestUpdates: boolean;
  messages: boolean;
  reviews: boolean;
  emailEnabled: boolean;
}

export const usersApi = {
  get: (id: string) => api.get<PublicUser>(`/users/${id}`),
  updateMe: (input: UpdateProfileInput) => api.patch<Me>('/users/me', input),
  stats: () => api.get<DashboardStats>('/users/me/stats'),
  reviews: (id: string, page = 1) => api.getPage<ReviewDto[]>(`/users/${id}/reviews`, { page, pageSize: 10 }),
  prefs: () => api.get<Prefs>('/users/me/notification-preferences'),
  updatePrefs: (p: Partial<Prefs>) => api.patch<Prefs>('/users/me/notification-preferences', p),
  deleteMe: (input: { password: string; confirm: 'DELETE' }) => api.delete('/users/me', input),
};

export const avatarApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.upload<Me>('/users/me/avatar', form);
  },
  remove: () => api.delete<Me>('/users/me/avatar'),
};
