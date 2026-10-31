import type { ReportReason } from '@borrowbox/shared';
import { api } from './client';

export interface AdminReport {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
  createdAt: string;
  reporter: { id: string; name: string };
  item: { id: string; title: string; status: string } | null;
  reportedUser: { id: string; name: string } | null;
}

export const reportsApi = {
  create: (input: { itemId?: string; userId?: string; reason: ReportReason; details?: string }) => api.post('/reports', input),
  adminList: (status?: string, page = 1) => api.getPage<AdminReport[]>('/admin/reports', { status, page, pageSize: 20 }),
  adminResolve: (id: string, input: { status: 'REVIEWED' | 'ACTIONED' | 'DISMISSED'; note?: string; hideItem?: boolean }) =>
    api.post(`/admin/reports/${id}/resolve`, input),
  adminRestoreItem: (itemId: string) => api.post(`/admin/items/${itemId}/restore`, {}),
};
