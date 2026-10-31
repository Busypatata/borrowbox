import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import type { NotificationDto } from '@borrowbox/shared';
import { notificationsApi } from '@/api/notifications.api';
import { qk } from '@/lib/queryKeys';
import { cn, errorMessage, timeAgo } from '@/lib/utils';
import { notificationHref } from '@/features/notifications/links';
import { Button } from '@/components/ui/Button';

export function useUnreadNotifications() {
  return useQuery({ queryKey: qk.unreadNotifications, queryFn: notificationsApi.unread, refetchInterval: 15_000, select: (d) => d.count });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const unread = useUnreadNotifications().data ?? 0;
  const list = useQuery({ queryKey: [...qk.notifications, 'preview'], queryFn: () => notificationsApi.list(1), enabled: open });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.notifications });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const markOne = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });

  const items = list.data?.data.slice(0, 6) ?? [];
  const go = (n: NotificationDto) => {
    if (!n.readAt) markOne.mutate(n.id);
    setOpen(false);
    navigate(notificationHref(n));
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative rounded-xl p-2.5 hover:bg-blush/50">
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-burgundy px-1 text-[10px] font-bold leading-none text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div role="region" aria-label="Recent notifications" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-blush bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-blush/70 px-4 py-3">
            <h2 className="font-sans text-sm font-semibold">Notifications</h2>
            <Button size="sm" variant="ghost" disabled={unread === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</Button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {list.isLoading && <li className="px-4 py-6 text-center text-sm text-charcoal-70">Loading…</li>}
            {list.isError && <li className="px-4 py-6 text-center text-sm text-danger">Couldn't load notifications.</li>}
            {!list.isLoading && !list.isError && items.length === 0 && <li className="px-4 py-8 text-center text-sm text-charcoal-70">You're all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => go(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-blush/30', !n.readAt && 'bg-pale/40')}>
                  <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-burgundy')} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{n.title}</span>
                    <span className="line-clamp-2 text-xs text-charcoal-70">{n.body}</span>
                    <span className="text-xs text-charcoal-70">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-blush/70 px-4 py-3 text-center text-sm font-semibold text-burgundy hover:bg-blush/30">View all notifications</Link>
        </div>
      )}
    </div>
  );
}
