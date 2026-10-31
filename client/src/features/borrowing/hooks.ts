import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { conversationsApi } from '@/api/conversations.api';
import { qk } from '@/lib/queryKeys';
import { errorMessage } from '@/lib/utils';

/** After any borrowing mutation, everything derived from it must be refreshed. */
export function useInvalidateBorrowing() {
  const qc = useQueryClient();
  return () => {
    for (const key of [qk.requestsAll, qk.transactionsAll, qk.stats, qk.notifications, qk.itemsAll]) void qc.invalidateQueries({ queryKey: key });
  };
}

export function useMessageUser() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (v: { recipientId: string; itemId?: string; requestId?: string }) => conversationsApi.open(v),
    onSuccess: (c) => navigate(`/messages/${c.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
