import type { ConversationDto, MessageDto } from '@borrowbox/shared';
import { api } from './client';

export const conversationsApi = {
  list: () => api.getPage<ConversationDto[]>('/conversations', { pageSize: 50 }),
  get: (id: string) => api.get<ConversationDto>(`/conversations/${id}`),
  open: (input: { recipientId: string; itemId?: string; requestId?: string }) => api.post<ConversationDto>('/conversations', input),
  messages: (id: string, before?: string) => api.getPage<MessageDto[]>(`/conversations/${id}/messages`, { before, limit: 30 }),
  send: (id: string, body: string, clientId: string) => api.post<MessageDto>(`/conversations/${id}/messages`, { body, clientId }),
  markRead: (id: string) => api.post(`/conversations/${id}/read`),
  unread: () => api.get<{ count: number }>('/conversations/unread-count'),
};
