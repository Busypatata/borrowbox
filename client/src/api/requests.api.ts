import type { CreateRequestInput, RequestDto, TransactionDto } from '@borrowbox/shared';
import { api } from './client';

export const requestsApi = {
  create: (input: CreateRequestInput) => api.post<RequestDto>('/requests', input),
  list: (side: 'incoming' | 'outgoing', f: { status?: string; page?: number } = {}) =>
    api.getPage<RequestDto[]>(`/requests/${side}`, { ...f, pageSize: 20 }),
  get: (id: string) => api.get<RequestDto>(`/requests/${id}`),
  approve: (id: string) => api.post<RequestDto>(`/requests/${id}/approve`),
  decline: (id: string, reason?: string) => api.post<RequestDto>(`/requests/${id}/decline`, { reason }),
  cancel: (id: string, reason?: string) => api.post<RequestDto>(`/requests/${id}/cancel`, { reason }),

  transactions: (f: { status?: string; role?: 'OWNER' | 'BORROWER'; page?: number } = {}) =>
    api.getPage<TransactionDto[]>('/transactions', { ...f, pageSize: 20 }),
  confirmHandover: (id: string) => api.post<TransactionDto>(`/transactions/${id}/confirm-handover`),
  requestReturn: (id: string) => api.post<TransactionDto>(`/transactions/${id}/request-return`),
  confirmReturn: (id: string) => api.post<TransactionDto>(`/transactions/${id}/confirm-return`),
};
