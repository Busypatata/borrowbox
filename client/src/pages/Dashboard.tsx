import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, Gift, HandHeart, Inbox, Package, Plus, Send } from 'lucide-react';
import { itemsApi } from '@/api/items.api';
import { notificationsApi } from '@/api/notifications.api';
import { requestsApi } from '@/api/requests.api';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/misc';
import { useStats } from '@/components/layout/AppLayout';
import { qk } from '@/lib/queryKeys';
import { cn, formatRange, timeAgo } from '@/lib/utils';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { TransactionStatusBadge } from '@/components/ui/Misc';
import { notificationHref } from '@/features/notifications/links';

function Stat({ to, icon: Icon, value, label, tone }: { to: string; icon: typeof Inbox; value?: number; label: string; tone: string }) {
  return (
    <Link to={to} className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-pop">
      <span className={cn('grid h-11 w-11 place-items-center rounded-xl', tone)}><Icon className="h-5 w-5" aria-hidden /></span>
      <span><span className="block font-display text-3xl leading-none">{value ?? '–'}</span><span className="text-sm text-charcoal-70">{label}</span></span>
    </Link>
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const stats = useStats();
  const active = useQuery({ queryKey: qk.transactions({ dash: true }), queryFn: () => requestsApi.transactions({ status: 'AWAITING_HANDOVER,BORROWED,RETURN_REQUESTED' }) });
  const notes = useQuery({ queryKey: [...qk.notifications, 'dash'], queryFn: () => notificationsApi.list(1) });
  const mine = useQuery({ queryKey: qk.myItems({ dash: true }), queryFn: () => itemsApi.mine({ status: 'AVAILABLE' }) });
  const s = stats.data;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl">{greet}, {user?.name.split(' ')[0]}!</h1><p className="mt-1 text-sm text-charcoal-70">Here's what's happening with your items and requests.</p></div>
      {stats.isError && <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat to="/requests/incoming" icon={Inbox} value={s?.incomingPending} label="Incoming requests" tone="bg-blush text-burgundy" />
        <Stat to="/borrowings" icon={HandHeart} value={s?.activeBorrowings} label="Active borrowings" tone="bg-pale text-mist-700" />
        <Stat to="/lending" icon={Gift} value={s?.activeLending} label="Currently lent out" tone="bg-success-soft text-success" />
        <Stat to="/my-items" icon={Package} value={s?.itemsListed} label="Items listed" tone="bg-blush text-burgundy" />
      </div>
      {(s?.outgoingPending ?? 0) > 0 && <p className="text-sm"><Send className="mr-1.5 inline h-4 w-4 text-mist-700" aria-hidden />You have <Link className="link" to="/requests/outgoing">{s!.outgoingPending} pending {s!.outgoingPending === 1 ? 'request' : 'requests'}</Link> waiting on an owner.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="up">
          <div className="mb-3 flex items-center justify-between"><h2 id="up" className="text-xl">Upcoming &amp; active</h2></div>
          {active.isLoading ? <Skeleton className="h-32" /> : active.isError ? <ErrorState error={active.error} onRetry={() => void active.refetch()} /> : (active.data?.data.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-charcoal-70">No handovers or returns coming up.</p> : (
            <ul className="divide-y divide-blush/60">
              {active.data!.data.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link to={t.role === 'OWNER' ? '/lending' : '/borrowings'} className="flex items-center gap-3 py-3">
                    <div className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-pale/60">{t.item.image && <img src={t.item.image.url} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.item.title}</p><p className="truncate text-xs text-charcoal-70">{t.role === 'OWNER' ? `Lent to ${t.borrower.name}` : `From ${t.owner.name}`} · {formatRange(t.startDate, t.endDate)}</p></div>
                    <TransactionStatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5" aria-labelledby="rn">
          <div className="mb-3 flex items-center justify-between"><h2 id="rn" className="text-xl">Recent notifications</h2><Link to="/notifications" className="link text-sm">View all</Link></div>
          {notes.isLoading ? <Skeleton className="h-32" /> : notes.isError ? <ErrorState error={notes.error} onRetry={() => void notes.refetch()} /> : (notes.data?.data.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-charcoal-70">You're all caught up.</p> : (
            <ul className="divide-y divide-blush/60">
              {notes.data!.data.slice(0, 5).map((n) => (
                <li key={n.id}><Link to={notificationHref(n)} className="flex gap-3 py-3"><Bell className={cn('mt-0.5 h-4 w-4 shrink-0', n.readAt ? 'text-charcoal-70' : 'text-burgundy')} aria-hidden /><span className="min-w-0 flex-1"><span className={cn('block truncate text-sm', !n.readAt && 'font-semibold')}>{n.title}</span><span className="line-clamp-1 text-xs text-charcoal-70">{n.body}</span></span><span className="text-xs text-charcoal-70">{timeAgo(n.createdAt)}</span></Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-5" aria-labelledby="ri">
          <div className="mb-3 flex items-center justify-between"><h2 id="ri" className="text-xl">Recently listed items</h2><Link to="/my-items" className="link text-sm">Manage</Link></div>
          {mine.isLoading ? <Skeleton className="h-28" /> : (mine.data?.data.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-charcoal-70">You haven't listed anything yet.</p> : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">{mine.data!.data.slice(0, 4).map((i) => <li key={i.id}><Link to={`/items/${i.id}`} className="block"><div className="aspect-[4/3] overflow-hidden rounded-xl bg-pale/60">{i.image && <img src={i.image.url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div><p className="mt-1.5 truncate text-sm font-medium">{i.title}</p></Link></li>)}</ul>
          )}
        </section>
        <EmptyState className="bg-pale/40" icon={<Package className="h-6 w-6" aria-hidden />} title="List an item" body="Give your belongings a second life." action={<LinkButton to="/items/new" icon={<Plus className="h-4 w-4" aria-hidden />}>Create listing</LinkButton>} />
      </div>
    </div>
  );
}
