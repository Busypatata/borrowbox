import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Archive, ImageOff, Pencil, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { MyItem } from '@borrowbox/shared';
import { itemsApi } from '@/api/items.api';
import { useDebounced, useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { categoryLabel, errorMessage } from '@/lib/utils';
import { Button, LinkButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Badge, PageHeader, Pagination } from '@/components/ui/Misc';

const STATUS_TONE = { AVAILABLE: 'success', UNAVAILABLE: 'warn', ARCHIVED: 'neutral', HIDDEN: 'danger' } as const;
const STATUS_LABEL = { AVAILABLE: 'Available', UNAVAILABLE: 'Unavailable', ARCHIVED: 'Archived', HIDDEN: 'Hidden by moderators' } as const;

export default function MyItems() {
  useDocumentTitle('My items');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [archiving, setArchiving] = useState<MyItem | null>(null);
  const q = useDebounced(search);
  const filters = { q: q || undefined, status: status || undefined, page };
  const list = useQuery({ queryKey: qk.myItems(filters), queryFn: () => itemsApi.mine(filters), placeholderData: keepPreviousData });

  const refresh = () => { void qc.invalidateQueries({ queryKey: qk.itemsAll }); void qc.invalidateQueries({ queryKey: qk.stats }); };
  const archive = useMutation({
    mutationFn: (i: MyItem) => itemsApi.archive(i.id),
    onSuccess: () => { toast.success('Listing archived'); setArchiving(null); refresh(); },
  });
  const reactivate = useMutation({
    mutationFn: (i: MyItem) => itemsApi.reactivate(i.id),
    onSuccess: () => { toast.success('Listing reactivated'); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const items = list.data?.data ?? [];
  return (
    <div>
      <PageHeader title="My Items" subtitle="Everything you've shared with the community." actions={<LinkButton to="/items/new" icon={<Plus className="h-4 w-4" aria-hidden />}>List an item</LinkButton>} />
      <div className="mb-5 flex flex-wrap gap-3">
        <input aria-label="Search my items" placeholder="Search my items" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="min-w-[14rem] flex-1 rounded-xl border border-blush bg-white px-3.5 py-2.5 text-sm" />
        <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-xl border border-blush bg-white px-3 py-2.5 text-sm">
          <option value="">All statuses</option><option value="AVAILABLE">Available</option><option value="UNAVAILABLE">Unavailable</option><option value="ARCHIVED">Archived</option>
        </select>
      </div>
      {list.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div> : list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : items.length === 0 ? (
        <EmptyState title={search || status ? 'No matching items' : "You haven't listed anything yet"} body={search || status ? 'Try a different search or filter.' : 'Lend a drill, a textbook, a tent — someone nearby will thank you.'} action={!search && !status ? <LinkButton to="/items/new">Create your first listing</LinkButton> : undefined} />
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-pale/60 sm:w-32">{i.image ? <img src={i.image.url} alt={i.image.altText} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-charcoal-70"><ImageOff className="h-6 w-6" aria-label="No photo" /></div>}</div>
              <div className="min-w-0 flex-1">
                <Link to={`/items/${i.id}`} className="block truncate font-semibold hover:underline">{i.title}</Link>
                <p className="text-sm text-charcoal-70">{categoryLabel(i.category)} · {i.community}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                  {i.activeReservation && <Badge tone="info">Active reservation</Badge>}
                  {i.pendingRequests > 0 && <Link to="/requests/incoming"><Badge tone="warn">{i.pendingRequests} pending {i.pendingRequests === 1 ? 'request' : 'requests'}</Badge></Link>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkButton to={`/items/${i.id}`} variant="ghost" size="sm">Details</LinkButton>
                <LinkButton to={`/items/${i.id}/edit`} variant="outline" size="sm" icon={<Pencil className="h-4 w-4" aria-hidden />}>Edit</LinkButton>
                {i.status === 'ARCHIVED' ? <Button size="sm" variant="soft" icon={<RotateCcw className="h-4 w-4" aria-hidden />} loading={reactivate.isPending && reactivate.variables?.id === i.id} onClick={() => reactivate.mutate(i)}>Reactivate</Button>
                  : i.status !== 'HIDDEN' && <Button size="sm" variant="ghost" icon={<Archive className="h-4 w-4" aria-hidden />} onClick={() => { archive.reset(); setArchiving(i); }}>Archive</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={list.data?.meta.totalPages ?? 1} onChange={setPage} />
      <ConfirmDialog open={!!archiving} onClose={() => setArchiving(null)} title="Archive this listing?" description={`"${archiving?.title ?? ''}" will disappear from search and pending requests will be declined. You can reactivate it later.`} confirmLabel="Archive listing" danger loading={archive.isPending} error={archive.isError ? errorMessage(archive.error) : undefined} onConfirm={() => archiving && archive.mutate(archiving)} />
    </div>
  );
}
