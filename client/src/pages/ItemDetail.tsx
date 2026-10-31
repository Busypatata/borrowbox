import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Flag, ImageOff, Lock, MapPin, MessageSquare, Pencil, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { itemsApi } from '@/api/items.api';
import { conversationsApi } from '@/api/conversations.api';
import { ApiError } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { categoryLabel, cn, conditionLabel, errorMessage, formatDate, formatRange } from '@/lib/utils';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { Avatar, Badge, RatingSummary, RequestStatusBadge } from '@/components/ui/Misc';
import { FavoriteButton, ItemGrid } from '@/components/items/ItemCard';
import { AdaptiveLayout } from '@/components/layout/AppLayout';
import { BorrowRequestForm } from '@/features/borrowing/BorrowRequestForm';
import { ReportDialog } from '@/features/reports/ReportDialog';

function Gallery({ images, title }: { images: { id: string; url: string; altText: string }[]; title: string }) {
  const [i, setI] = useState(0);
  const current = images[Math.min(i, images.length - 1)];
  if (!current) return <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-pale/60 text-charcoal-70"><ImageOff className="h-10 w-10" aria-label={`No photos of ${title}`} /></div>;
  return (
    <div>
      <img src={current.url} alt={current.altText} className="aspect-[4/3] w-full rounded-2xl bg-pale/60 object-cover" />
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Photo thumbnails">
          {images.map((im, idx) => (
            <li key={im.id}>
              <button type="button" onClick={() => setI(idx)} aria-label={`Show photo ${idx + 1} of ${images.length}`} aria-current={idx === i} className={cn('block overflow-hidden rounded-xl border-2', idx === i ? 'border-burgundy' : 'border-transparent opacity-80 hover:opacity-100')}>
                <img src={im.url} alt="" loading="lazy" className="h-16 w-20 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Body() {
  const { itemId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [reporting, setReporting] = useState(false);
  const q = useQuery({ queryKey: qk.item(itemId), queryFn: () => itemsApi.get(itemId), retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 });
  const similar = useQuery({ queryKey: qk.similar(itemId), queryFn: () => itemsApi.similar(itemId), enabled: q.isSuccess });
  const item = q.data;
  useDocumentTitle(item?.title);

  const message = useMutation({
    mutationFn: () => conversationsApi.open({ recipientId: item!.owner.id, itemId: item!.id }),
    onSuccess: (c) => navigate(`/messages/${c.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]"><Skeleton className="aspect-[4/3]" /><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /></div></div>;
  if (q.error instanceof ApiError && q.error.status === 404) return <EmptyState title="This item isn't available" body="It may have been removed, archived or is no longer shared." action={<LinkButton to="/browse">Browse items</LinkButton>} />;
  if (q.isError || !item) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const here = location.pathname + location.search;
  const archived = item.status === 'ARCHIVED' || item.status === 'HIDDEN';
  const unavailable = item.status !== 'AVAILABLE';
  const req = item.myActiveRequest;

  let action;
  if (item.isOwner) {
    action = (
      <div className="space-y-3">
        <InlineNotice>This is your listing.{archived && ` It is currently ${item.status === 'HIDDEN' ? 'hidden by moderators' : 'archived'}.`}</InlineNotice>
        <LinkButton to={`/items/${item.id}/edit`} size="lg" className="w-full" icon={<Pencil className="h-4 w-4" aria-hidden />}>Edit listing</LinkButton>
        <LinkButton to="/my-items" variant="outline" className="w-full">Manage listing</LinkButton>
      </div>
    );
  } else if (unavailable) {
    action = <InlineNotice tone="warn">The owner has marked this item as unavailable right now. Save it to your wish list and check back soon.</InlineNotice>;
  } else if (!user) {
    action = (
      <div className="space-y-3">
        <p className="text-sm text-charcoal-70">Sign in to request this item.</p>
        <LinkButton to="/login" state={{ from: here }} variant="accent" size="lg" className="w-full">Sign in to borrow</LinkButton>
        <LinkButton to="/signup" state={{ from: here }} variant="outline" className="w-full">Create an account</LinkButton>
      </div>
    );
  } else if (req) {
    action = (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-pale/60 p-4"><span className="text-sm font-medium">Your request</span><RequestStatusBadge status={req.status} /></div>
        <LinkButton to="/requests/outgoing" variant="outline" className="w-full">View my requests</LinkButton>
      </div>
    );
  } else if (!user.emailVerified) {
    action = <InlineNotice tone="warn"><Lock className="mr-1 inline h-4 w-4" aria-hidden />Verify your email to send borrowing requests. Check your inbox for the link.</InlineNotice>;
  } else {
    action = <BorrowRequestForm item={item} />;
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-charcoal-70"><Link to="/browse" className="hover:underline">Browse</Link> / <Link to={`/browse?category=${item.category}`} className="hover:underline">{categoryLabel(item.category)}</Link></nav>
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <Gallery images={item.images} title={item.title} />
          <section className="mt-8" aria-labelledby="about"><h2 id="about" className="text-xl">About this item</h2><p className="mt-2 whitespace-pre-wrap text-charcoal-70">{item.description}</p></section>
          <section className="mt-8 grid gap-4 sm:grid-cols-2" aria-label="Pickup and availability">
            <div className="card p-5">
              <h2 className="font-sans text-base font-semibold">Pickup &amp; return</h2>
              <p className="mt-2 flex items-start gap-2 text-sm text-charcoal-70"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{item.community}, {item.city}{item.distanceKm !== null && ` · about ${item.distanceKm} km away`}</p>
              {item.pickupInstructions ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-pale/50 p-3 text-sm">{item.pickupInstructions}</p> : <p className="mt-3 flex items-start gap-2 text-sm text-charcoal-70"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Exact pickup details are shared after the owner approves your request.</p>}
            </div>
            <div className="card p-5">
              <h2 className="font-sans text-base font-semibold">Availability</h2>
              {item.bookedRanges.length === 0 ? <p className="mt-2 text-sm text-charcoal-70">No upcoming bookings — pick any dates.</p> : (
                <><p className="mt-2 text-sm text-charcoal-70">Already booked:</p><ul className="mt-1 space-y-1 text-sm">{item.bookedRanges.map((r) => <li key={r.startDate + r.endDate} className="flex items-center gap-2"><Calendar className="h-4 w-4 text-charcoal-70" aria-hidden />{formatRange(r.startDate, r.endDate)}</li>)}</ul></>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-3xl leading-tight">{item.title}</h1>
              <FavoriteButton item={item} className="border border-blush" />
            </div>
            <div className="flex flex-wrap gap-2"><Badge tone="info">{categoryLabel(item.category)}</Badge><Badge>{conditionLabel(item.condition)}</Badge><Badge tone={unavailable ? 'neutral' : 'success'}>{unavailable ? 'Unavailable' : 'Available'}</Badge></div>
            {action}
            {!item.isOwner && user && (
              <Button variant="outline" className="w-full" icon={<MessageSquare className="h-4 w-4" aria-hidden />} loading={message.isPending} onClick={() => message.mutate()}>Message owner</Button>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <Avatar name={item.owner.name} src={item.owner.profileImageUrl} size={48} />
              <div className="min-w-0"><Link to={`/users/${item.owner.id}`} className="block truncate font-semibold hover:underline">{item.owner.name}</Link><p className="text-xs text-charcoal-70">Member since {formatDate(item.owner.createdAt, { month: 'short', year: 'numeric' })}</p><RatingSummary average={item.owner.ratingAverage} count={item.owner.ratingCount} /></div>
            </div>
            <Link to={`/users/${item.owner.id}`} className="link mt-3 inline-block text-sm">View profile</Link>
          </div>

          {!item.isOwner && user && <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 text-sm text-charcoal-70 hover:text-danger"><Flag className="h-4 w-4" aria-hidden />Report listing</button>}
          {!item.isOwner && !user && <p className="flex items-center gap-1.5 text-xs text-charcoal-70"><ShieldAlert className="h-4 w-4" aria-hidden />Sign in to report a listing.</p>}
        </aside>
      </div>

      {similar.data && similar.data.length > 0 && (
        <section className="mt-14" aria-labelledby="similar"><h2 id="similar" className="mb-4 text-2xl">Similar items</h2><ItemGrid items={similar.data} /></section>
      )}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{ itemId: item.id, label: 'listing' }} />
    </div>
  );
}

export default function ItemDetail() {
  return <AdaptiveLayout><Body /></AdaptiveLayout>;
}
