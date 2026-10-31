import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Check, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import type { RequestDto } from '@borrowbox/shared';
import { requestsApi } from '@/api/requests.api';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Avatar, RatingSummary, RequestStatusBadge } from '@/components/ui/Misc';
import { errorMessage, formatRange, timeAgo } from '@/lib/utils';
import { useInvalidateBorrowing, useMessageUser } from './hooks';

type Dialog = null | 'approve' | 'decline' | 'cancel';

export function RequestCard({ request, side }: { request: RequestDto; side: 'incoming' | 'outgoing' }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const invalidate = useInvalidateBorrowing();
  const message = useMessageUser();
  const other = side === 'incoming' ? request.borrower : request.owner;

  const done = (text: string) => { toast.success(text); invalidate(); setDialog(null); setReason(''); };
  const approve = useMutation({ mutationFn: () => requestsApi.approve(request.id), onSuccess: () => done('Request approved. The borrower has been notified.') });
  const decline = useMutation({ mutationFn: () => requestsApi.decline(request.id, reason.trim() || undefined), onSuccess: () => done('Request declined.') });
  const cancel = useMutation({ mutationFn: () => requestsApi.cancel(request.id), onSuccess: () => done('Request cancelled.') });
  const active = dialog === 'approve' ? approve : dialog === 'decline' ? decline : cancel;
  // A conflict/state error also means the list is stale: refresh it so buttons match reality.
  const close = () => { if (active.isError) invalidate(); active.reset(); setDialog(null); };

  const pending = request.status === 'PENDING';
  return (
    <article className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-pale/60">{request.item.image && <img src={request.item.image.url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
          <div className="min-w-0"><Link to={`/items/${request.item.id}`} className="block truncate font-semibold hover:underline">{request.item.title}</Link><p className="flex items-center gap-1.5 text-sm text-charcoal-70"><Calendar className="h-4 w-4" aria-hidden />{formatRange(request.startDate, request.endDate)}</p></div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-pale/40 p-3">
        <Avatar name={other.name} src={other.profileImageUrl} size={36} />
        <div className="min-w-0 text-sm">
          <p><span className="text-charcoal-70">{side === 'incoming' ? 'Requested by ' : 'Owner: '}</span><Link to={`/users/${other.id}`} className="font-semibold hover:underline">{other.name}</Link></p>
          {side === 'incoming' && <RatingSummary average={request.borrower.ratingAverage} count={request.borrower.ratingCount} />}
        </div>
        <span className="ml-auto text-xs text-charcoal-70">{timeAgo(request.createdAt)}</span>
      </div>

      {request.message && <p className="whitespace-pre-wrap rounded-xl border border-blush/70 p-3 text-sm">“{request.message}”</p>}
      {request.cancellationReason && request.status !== 'APPROVED' && <p className="text-sm text-charcoal-70">Reason: {request.cancellationReason}</p>}
      {request.status === 'APPROVED' && request.transaction && <p className="text-sm text-success">Approved — <Link className="link" to={side === 'incoming' ? '/lending' : '/borrowings'}>track the handover</Link>.</p>}

      <div className="flex flex-wrap gap-2">
        {pending && side === 'incoming' && <>
          <Button size="sm" icon={<Check className="h-4 w-4" aria-hidden />} onClick={() => setDialog('approve')}>Approve</Button>
          <Button size="sm" variant="outline" icon={<X className="h-4 w-4" aria-hidden />} onClick={() => setDialog('decline')}>Decline</Button>
        </>}
        {pending && side === 'outgoing' && <Button size="sm" variant="outline" onClick={() => setDialog('cancel')}>Cancel request</Button>}
        {request.status !== 'DECLINED' && request.status !== 'CANCELLED' && (
          <Button size="sm" variant="ghost" icon={<MessageSquare className="h-4 w-4" aria-hidden />} loading={message.isPending} onClick={() => message.mutate({ recipientId: other.id, itemId: request.item.id, requestId: request.id })}>Message {other.name.split(' ')[0]}</Button>
        )}
      </div>

      <ConfirmDialog open={dialog === 'approve'} onClose={close} title="Approve this request?" description={`${request.borrower.name} will be able to borrow "${request.item.title}" for ${formatRange(request.startDate, request.endDate)}. Overlapping pending requests will be declined.`} confirmLabel="Approve" loading={approve.isPending} error={approve.isError ? errorMessage(approve.error) : undefined} onConfirm={() => approve.mutate()} />
      <ConfirmDialog open={dialog === 'decline'} onClose={close} title="Decline this request?" description="The borrower will be notified." confirmLabel="Decline request" danger loading={decline.isPending} error={decline.isError ? errorMessage(decline.error) : undefined} onConfirm={() => decline.mutate()}>
        <TextArea label="Reason (optional)" maxLength={300} className="min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'cancel'} onClose={close} title="Cancel this request?" description="The owner will be notified. You can send a new request later." confirmLabel="Cancel request" danger loading={cancel.isPending} error={cancel.isError ? errorMessage(cancel.error) : undefined} onConfirm={() => cancel.mutate()} />
    </article>
  );
}
