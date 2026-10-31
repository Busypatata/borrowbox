import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { notificationsApi } from '@/api/notifications.api';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { cn, errorMessage, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader, Pagination } from '@/components/ui/Misc';
import { notificationHref } from '@/features/notifications/links';

export default function Notifications() {
  useDocumentTitle('Notifications');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...qk.notifications, page], queryFn: () => notificationsApi.list(page), refetchInterval: 20_000 });
  const refresh = () => { void qc.invalidateQueries({ queryKey: qk.notifications }); void qc.invalidateQueries({ queryKey: qk.stats }); };
  const readAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: () => { refresh(); toast.success('All notifications marked as read'); }, onError: (e) => toast.error(errorMessage(e)) });
  const readOne = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });
  const rows = q.data?.data ?? [];
  const unread = q.data?.meta.unread ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : 'You are all caught up'} actions={<Button variant="outline" size="sm" disabled={unread === 0} loading={readAll.isPending} icon={<CheckCheck className="h-4 w-4" aria-hidden />} onClick={() => readAll.mutate()}>Mark all as read</Button>} />
      {q.isLoading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : rows.length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" aria-hidden />} title="No notifications yet" body="Updates about your requests, messages and reviews will show up here." /> : (
        <ul className="card divide-y divide-blush/60 overflow-hidden">
          {rows.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => { if (!n.readAt) readOne.mutate(n.id); navigate(notificationHref(n)); }} className={cn('flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-blush/30', !n.readAt && 'bg-pale/40')}>
                <span aria-hidden className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-burgundy')} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{n.title}{!n.readAt && <span className="sr-only"> (unread)</span>}</span><span className="block text-sm text-charcoal-70">{n.body}</span></span>
                <span className="shrink-0 text-xs text-charcoal-70">{timeAgo(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={q.data?.meta.totalPages ?? 1} onChange={setPage} />
    </div>
  );
}
