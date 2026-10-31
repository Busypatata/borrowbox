import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Flag, MapPin, MessageSquare } from 'lucide-react';
import { itemsApi } from '@/api/items.api';
import { usersApi } from '@/api/users.api';
import { ApiError } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { formatDate, timeAgo } from '@/lib/utils';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Avatar, Pagination, RatingSummary, Tabs } from '@/components/ui/Misc';
import { ItemGrid, ItemGridSkeleton } from '@/components/items/ItemCard';
import { ReportDialog } from '@/features/reports/ReportDialog';
import { useMessageUser } from '@/features/borrowing/hooks';
import { Star } from 'lucide-react';

type Tab = 'reviews' | 'items' | 'activity';

export default function Profile() {
  const params = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = params.userId ?? user!.id;
  const self = userId === user?.id;
  const [tab, setTab] = useState<Tab>('reviews');
  const [page, setPage] = useState(1);
  const [reporting, setReporting] = useState(false);
  const message = useMessageUser();

  const profile = useQuery({ queryKey: qk.user(userId), queryFn: () => usersApi.get(userId), retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 });
  const reviews = useQuery({ queryKey: [...qk.reviews(userId), page], queryFn: () => usersApi.reviews(userId, page), enabled: tab === 'reviews' && profile.isSuccess });
  const items = useQuery({ queryKey: qk.items({ ownerId: userId, page }), queryFn: () => itemsApi.list({ ownerId: userId, page, pageSize: 8 }), enabled: tab === 'items' && profile.isSuccess });
  const p = profile.data;
  useDocumentTitle(p ? (self ? 'My profile' : p.name) : undefined);

  if (profile.isLoading) return <div className="space-y-4"><Skeleton className="h-44" /><Skeleton className="h-64" /></div>;
  if (profile.error instanceof ApiError && profile.error.status === 404) return <EmptyState title="Member not found" body="This account doesn't exist or is no longer active." action={<LinkButton to="/browse">Browse items</LinkButton>} />;
  if (profile.isError || !p) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;

  return (
    <div className="space-y-6">
      <section className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
        <Avatar name={p.name} src={p.profileImageUrl} size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl">{p.name}</h1>{p.verified && <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />Verified</span>}</div>
          <p className="mt-1 text-sm text-charcoal-70">Member since {formatDate(p.createdAt, { month: 'short', year: 'numeric' })}</p>
          {(p.community || p.city) && <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal-70"><MapPin className="h-4 w-4" aria-hidden />{[p.community, p.city].filter(Boolean).join(', ')}</p>}
          <div className="mt-1"><RatingSummary average={p.ratingAverage} count={p.ratingCount} /></div>
          {p.bio ? <p className="mt-3 max-w-2xl text-sm">{p.bio}</p> : self && <p className="mt-3 text-sm text-charcoal-70">Add a short bio so neighbours know who you are.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {self ? <LinkButton to="/settings" variant="outline" size="sm">Edit profile</LinkButton> : (<>
              <Button size="sm" icon={<MessageSquare className="h-4 w-4" aria-hidden />} loading={message.isPending} onClick={() => user ? message.mutate({ recipientId: p.id }) : navigate('/login', { state: { from: `/users/${p.id}` } })}>Message</Button>
              {user && <Button size="sm" variant="ghost" icon={<Flag className="h-4 w-4" aria-hidden />} onClick={() => setReporting(true)}>Report</Button>}
            </>)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3" aria-label="Statistics">
        {[['Items listed', p.itemsListed], ['Completed loans', p.completedLoans], ['Completed borrows', p.completedBorrows]].map(([l, v]) => (
          <div key={l} className="card p-4 text-center"><p className="font-display text-3xl">{v}</p><p className="text-xs text-charcoal-70 sm:text-sm">{l}</p></div>
        ))}
      </section>

      <div>
        <Tabs label="Profile sections" value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ id: 'reviews', label: `Reviews (${p.ratingCount})` }, { id: 'items', label: 'Items' }, { id: 'activity', label: 'Activity' }]} />
        {tab === 'reviews' && (reviews.isLoading ? <Skeleton className="h-32" /> : reviews.isError ? <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} /> : (reviews.data?.data.length ?? 0) === 0 ? <EmptyState icon={<Star className="h-6 w-6" aria-hidden />} title="No reviews yet" body="Reviews appear after completed loans." /> : (
          <ul className="space-y-3">{reviews.data!.data.map((r) => (
            <li key={r.id} className="card flex gap-4 p-5">
              <Avatar name={r.reviewer.name} src={r.reviewer.profileImageUrl} size={40} />
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><Link to={`/users/${r.reviewer.id}`} className="font-semibold hover:underline">{r.reviewer.name}</Link><span className="text-xs text-charcoal-70">{timeAgo(r.createdAt)}</span></div><p className="mt-0.5 flex items-center gap-1 text-sm" aria-label={`${r.rating} out of 5 stars`}><Star className="h-4 w-4 fill-[#E0A93B] text-[#E0A93B]" aria-hidden />{r.rating}.0</p>{r.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{r.comment}</p>}</div>
            </li>))}</ul>
        ))}
        {tab === 'items' && (items.isLoading ? <ItemGridSkeleton count={4} /> : items.isError ? <ErrorState error={items.error} onRetry={() => void items.refetch()} /> : (items.data?.data.length ?? 0) === 0 ? <EmptyState title="No items to show" body={self ? 'Items you list will appear here.' : 'This member has no available items right now.'} /> : <ItemGrid items={items.data!.data} />)}
        {tab === 'activity' && (
          <div className="card p-6 text-sm"><ul className="space-y-2"><li><strong>{p.completedLoans}</strong> items lent and returned</li><li><strong>{p.completedBorrows}</strong> items borrowed and returned</li><li><strong>{p.itemsListed}</strong> active listings</li></ul></div>
        )}
        {tab === 'reviews' && <Pagination page={page} totalPages={reviews.data?.meta.totalPages ?? 1} onChange={setPage} />}
        {tab === 'items' && <Pagination page={page} totalPages={items.data?.meta.totalPages ?? 1} onChange={setPage} />}
      </div>
      {!self && <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{ userId: p.id, label: p.name }} />}
    </div>
  );
}
