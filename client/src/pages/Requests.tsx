import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { requestsApi } from '@/api/requests.api';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader, Pagination, Tabs } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';
import { RequestCard } from '@/features/borrowing/RequestCard';

type Tab = 'pending' | 'approved' | 'history';
const FILTER: Record<Tab, string> = { pending: 'PENDING', approved: 'APPROVED', history: 'DECLINED,CANCELLED,COMPLETED' };

export default function Requests({ side }: { side: 'incoming' | 'outgoing' }) {
  const incoming = side === 'incoming';
  useDocumentTitle(incoming ? 'Incoming requests' : 'My requests');
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);
  const filters = { status: FILTER[tab], page };
  const q = useQuery({ queryKey: qk.requests(side, filters), queryFn: () => requestsApi.list(side, filters), refetchInterval: 30_000 });
  const rows = q.data?.data ?? [];
  return (
    <div>
      <PageHeader title={incoming ? 'Incoming Requests' : 'My Requests'} subtitle={incoming ? 'People who want to borrow your items.' : 'Items you have asked to borrow.'} />
      <Tabs label="Request status" value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ id: 'pending', label: 'Awaiting decision' }, { id: 'approved', label: 'Approved' }, { id: 'history', label: 'History' }]} />
      {q.isLoading ? <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-52" />)}</div> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : rows.length === 0 ? (
        <EmptyState title={tab === 'pending' ? 'Nothing waiting' : tab === 'approved' ? 'No approved requests' : 'No history yet'} body={incoming ? 'When someone asks to borrow one of your items, it will show up here.' : 'Find something you need and send your first request.'} action={!incoming ? <LinkButton to="/browse">Browse items</LinkButton> : undefined} />
      ) : <ul className="space-y-4">{rows.map((r) => <li key={r.id}><RequestCard request={r} side={side} /></li>)}</ul>}
      <Pagination page={page} totalPages={q.data?.meta.totalPages ?? 1} onChange={setPage} />
    </div>
  );
}
