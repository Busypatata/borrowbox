import type { CreateReviewInput, ReviewDto } from '@borrowbox/shared';
import { api } from './client';

export const reviewsApi = {
  create: (transactionId: string, input: CreateReviewInput) => api.post<ReviewDto>(`/transactions/${transactionId}/reviews`, input),
};
