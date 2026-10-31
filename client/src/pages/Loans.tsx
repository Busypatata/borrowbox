import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { requestsApi } from '@/api/requests.api';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader, Pagination, Tabs } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';
import { RequestCard } from '@/features/borrowing/RequestCard';
import { TransactionCard } from '@/features/borrowing/TransactionCard';

type Tab = 'upcoming' | 'current' | 'completed' | 'closed';
const TX_FILTER: Record<Exclude<Tab, 'closed'>, string> = { upcoming: 'AWAITING_HANDOVER', current: 'BORROWED,RETURN_REQUESTED', completed: 'COMPLETED' };

/** /borrowings (role BORROWER) and /lending (role OWNER). Transaction state and request state stay in separate tabs. */
export default function Loans({ role }: { role: 'BORROWER' | 'OWNER' }) {
  const lending = role === 'OWNER';
  useDocumentTitle(lending ? 'Lending' : 'My loans');
  const [tab, setTab] = useState<Tab>('upcoming');
  const [page, setPage] = useState(1);

  const txFilters = { role, status: tab === 'closed' ? '' : TX_FILTER[tab], page };
  const tx = useQuery({ queryKey: qk.transactions(txFilters), queryFn: () => requestsApi.transactions(txFilters), enabled: tab !== 'closed', refetchInterval: 30_000 });
  const reqFilters = { status: 'DECLINED,CANCELLED', page };
  const side = lending ? 'incoming' : 'outgoing';
  const closed = useQuery({ queryKey: qk.requests(side, reqFilters), queryFn: () => requestsApi.list(side, reqFilters), enabled: tab === 'closed' });

  const q = tab === 'closed' ? closed : tx;
  const empty = {
    upcoming: lending ? 'No upcoming handovers' : 'No upcoming borrowings',
    current: lending ? 'Nothing is lent out right now' : "You aren't borrowing anything right now",
    completed: 'No completed loans yet',
    closed: 'No declined or cancelled requests',
  }[tab];

  return (
    <div>
      <PageHeader title={lending ? 'Lent Out' : 'My Loans'} subtitle={lending ? 'Track handovers and returns for items you lend.' : 'Track the items you are borrowing.'} />
      <Tabs label="Loan status" value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[
        { id: 'upcoming', label: lending ? 'Upcoming handovers' : 'Upcoming' },
        { id: 'current', label: lending ? 'Lent out' : 'Borrowed now' },
        { id: 'completed', label: 'Completed' },
        { id: 'closed', label: 'Declined & cancelled' },
      ]} />
      {q.isLoading ? <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-52" />)}</div> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (q.data?.data.length ?? 0) === 0 ? (
        <EmptyState title={empty} body={lending ? 'Approved requests appear here until the item is back.' : 'Approved requests appear here once the owner accepts.'} action={!lending ? <LinkButton to="/browse">Browse items</LinkButton> : <LinkButton to="/requests/incoming" variant="outline">View incoming requests</LinkButton>} />
      ) : tab === 'closed' ? (
        <ul className="space-y-4">{closed.data!.data.map((r) => <li key={r.id}><RequestCard request={r} side={side} /></li>)}</ul>
      ) : (
        <ul className="space-y-4">{tx.data!.data.map((t) => <li key={t.id}><TransactionCard tx={t} /></li>)}</ul>
      )}
      <Pagination page={page} totalPages={q.data?.meta.totalPages ?? 1} onChange={setPage} />
    </div>
  );
}
