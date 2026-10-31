import type { CreateItemInput, ItemDetail, ItemSummary, MyItem, UpdateItemInput } from '@borrowbox/shared';
import { api } from './client';

export interface ItemFilters {
  q?: string;
  category?: string;
  condition?: string;
  community?: string;
  from?: string;
  to?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  ownerId?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export const itemsApi = {
  list: (f: ItemFilters, signal?: AbortSignal) => api.getPage<ItemSummary[]>('/items', f as never, signal),
  mine: (f: { q?: string; status?: string; page?: number }) => api.getPage<MyItem[]>('/items/mine', { ...f, pageSize: 12 }),
  get: (id: string) => api.get<ItemDetail>(`/items/${id}`),
  similar: (id: string) => api.get<ItemSummary[]>(`/items/${id}/similar`),
  create: (input: CreateItemInput) => api.post<ItemDetail>('/items', input),
  update: (id: string, input: UpdateItemInput) => api.patch<ItemDetail>(`/items/${id}`, input),
  archive: (id: string) => api.delete(`/items/${id}`),
  reactivate: (id: string) => api.post<ItemDetail>(`/items/${id}/reactivate`),
  uploadImages: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return api.upload<ItemDetail>(`/items/${id}/images`, form);
  },
  removeImage: (id: string, imageId: string) => api.delete<ItemDetail>(`/items/${id}/images/${imageId}`),
  categories: () => api.get<{ slug: string; label: string }[]>('/categories'),
  favorites: (page = 1) => api.getPage<ItemSummary[]>('/favorites', { page, pageSize: 12 }),
  favorite: (id: string) => api.post(`/favorites/${id}`),
  unfavorite: (id: string) => api.delete(`/favorites/${id}`),
};
