import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { REPORT_REASON_LABELS } from '@borrowbox/shared';
import { reportsApi, type AdminReport } from '@/api/reports.api';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { errorMessage, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Badge, PageHeader, Pagination, Tabs } from '@/components/ui/Misc';
import { EmptyState, ErrorState, InlineError, Skeleton } from '@/components/ui/Feedback';

type Filter = 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';

export default function AdminReports() {
  useDocumentTitle('Moderation');
  const qc = useQueryClient();
  const [status, setStatus] = useState<Filter>('OPEN');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<AdminReport | null>(null);
  const [note, setNote] = useState('');
  const q = useQuery({ queryKey: qk.adminReports({ status, page }), queryFn: () => reportsApi.adminList(status, page) });
  const resolve = useMutation({
    mutationFn: (v: { status: 'REVIEWED' | 'ACTIONED' | 'DISMISSED'; hideItem?: boolean }) => reportsApi.adminResolve(active!.id, { ...v, note: note.trim() || undefined }),
    onSuccess: () => { toast.success('Report updated'); setActive(null); setNote(''); void qc.invalidateQueries({ queryKey: ['admin'] }); },
  });
  const rows = q.data?.data ?? [];
  return (
    <div>
      <PageHeader title="Moderation" subtitle="Review reports and take action on listings." />
      <Tabs label="Report status" value={status} onChange={(s) => { setStatus(s); setPage(1); }} tabs={[{ id: 'OPEN', label: 'Open' }, { id: 'REVIEWED', label: 'Reviewed' }, { id: 'ACTIONED', label: 'Actioned' }, { id: 'DISMISSED', label: 'Dismissed' }]} />
      {q.isLoading ? <Skeleton className="h-40" /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : rows.length === 0 ? <EmptyState title="No reports here" /> : (
        <ul className="space-y-3">{rows.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="warn">{REPORT_REASON_LABELS[r.reason]}</Badge><span className="text-xs text-charcoal-70">{timeAgo(r.createdAt)} · by {r.reporter.name}</span></div>
              <p className="mt-1 text-sm">{r.item ? <>Listing: <Link className="link" to={`/items/${r.item.id}`}>{r.item.title}</Link> <Badge>{r.item.status}</Badge></> : <>Member: <Link className="link" to={`/users/${r.reportedUser?.id}`}>{r.reportedUser?.name}</Link></>}</p>
              {r.details && <p className="mt-1 text-sm text-charcoal-70">“{r.details}”</p>}
            </div>
            {r.status === 'OPEN' && <Button size="sm" onClick={() => { resolve.reset(); setActive(r); }}>Review</Button>}
          </li>))}</ul>
      )}
      <Pagination page={page} totalPages={q.data?.meta.totalPages ?? 1} onChange={setPage} />
      <Modal open={!!active} onClose={() => setActive(null)} title="Resolve report" description={active?.item ? `Listing: ${active.item.title}` : `Member: ${active?.reportedUser?.name ?? ''}`}
        footer={<>
          <Button variant="ghost" onClick={() => resolve.mutate({ status: 'DISMISSED' })} loading={resolve.isPending}>Dismiss</Button>
          <Button variant="outline" onClick={() => resolve.mutate({ status: 'REVIEWED' })} loading={resolve.isPending}>Mark reviewed</Button>
          {active?.item && <Button variant="danger" icon={<EyeOff className="h-4 w-4" aria-hidden />} onClick={() => resolve.mutate({ status: 'ACTIONED', hideItem: true })} loading={resolve.isPending}>Hide listing</Button>}
        </>}>
        <div className="space-y-3">{resolve.isError && <InlineError>{errorMessage(resolve.error)}</InlineError>}<TextArea label="Internal note (optional)" maxLength={500} className="min-h-20" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </Modal>
    </div>
  );
}
