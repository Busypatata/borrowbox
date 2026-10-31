import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Lock, MapPin, MessageSquare, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { TransactionDto } from '@borrowbox/shared';
import { requestsApi } from '@/api/requests.api';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Avatar, TransactionStatusBadge } from '@/components/ui/Misc';
import { errorMessage, formatDate, formatRange } from '@/lib/utils';
import { useInvalidateBorrowing, useMessageUser } from './hooks';
import { ReviewDialog } from './ReviewDialog';

type Action = 'handover' | 'return' | 'confirm';
const COPY: Record<Action, { title: string; description: string; confirm: string; success: string }> = {
  handover: { title: 'Confirm handover?', description: 'Confirm that you have handed the item to the borrower.', confirm: 'Confirm handover', success: 'Handover confirmed.' },
  return: { title: 'Mark as returned?', description: 'Let the owner know the item is ready to be returned. They will confirm once they have it back.', confirm: 'Request return confirmation', success: 'Return requested. The owner has been notified.' },
  confirm: { title: 'Confirm the return?', description: 'Confirm that the item is back with you in good order. This completes the loan.', confirm: 'Confirm return', success: 'Return confirmed — loan completed!' },
};

export function TransactionCard({ tx }: { tx: TransactionDto }) {
  const [action, setAction] = useState<Action | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const invalidate = useInvalidateBorrowing();
  const message = useMessageUser();
  const isOwner = tx.role === 'OWNER';
  const other = isOwner ? tx.borrower : tx.owner;

  const run = useMutation({
    mutationFn: (a: Action) => (a === 'handover' ? requestsApi.confirmHandover(tx.id) : a === 'return' ? requestsApi.requestReturn(tx.id) : requestsApi.confirmReturn(tx.id)),
    onSuccess: (_d, a) => { toast.success(COPY[a].success); invalidate(); setAction(null); },
  });
  const close = () => { if (run.isError) invalidate(); run.reset(); setAction(null); };

  const ownerCanHandover = isOwner && tx.status === 'AWAITING_HANDOVER';
  const borrowerCanReturn = !isOwner && tx.status === 'BORROWED';
  const ownerCanConfirmReturn = isOwner && (tx.status === 'BORROWED' || tx.status === 'RETURN_REQUESTED');
  const canReview = tx.status === 'COMPLETED' && !tx.myReviewSubmitted;

  return (
    <article className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-pale/60">{tx.item.image && <img src={tx.item.image.url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
          <div className="min-w-0"><Link to={`/items/${tx.item.id}`} className="block truncate font-semibold hover:underline">{tx.item.title}</Link><p className="flex items-center gap-1.5 text-sm text-charcoal-70"><Calendar className="h-4 w-4" aria-hidden />{formatRange(tx.startDate, tx.endDate)}</p></div>
        </div>
        <TransactionStatusBadge status={tx.status} />
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-pale/40 p-3 text-sm">
        <Avatar name={other.name} src={other.profileImageUrl} size={36} />
        <p><span className="text-charcoal-70">{isOwner ? 'Borrower: ' : 'Owner: '}</span><Link to={`/users/${other.id}`} className="font-semibold hover:underline">{other.name}</Link></p>
      </div>

      {tx.pickupInstructions && tx.status !== 'COMPLETED' && (
        <p className="flex items-start gap-2 rounded-xl border border-blush/70 p-3 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" aria-hidden /><span><strong>Pickup:</strong> {tx.pickupInstructions}</span></p>
      )}

      <ol className="space-y-1 text-xs text-charcoal-70" aria-label="Timeline">
        <li>Approved</li>
        {tx.handoverConfirmedAt && <li>Handed over {formatDate(tx.handoverConfirmedAt)}</li>}
        {tx.returnRequestedAt && <li>Return requested {formatDate(tx.returnRequestedAt)}</li>}
        {tx.completedAt && <li>Completed {formatDate(tx.completedAt)}</li>}
      </ol>

      {!isOwner && tx.status === 'AWAITING_HANDOVER' && <p className="flex items-center gap-1.5 text-xs text-charcoal-70"><Lock className="h-3.5 w-3.5" aria-hidden />The owner confirms the handover once you've collected the item.</p>}

      <div className="flex flex-wrap gap-2">
        {ownerCanHandover && <Button size="sm" onClick={() => setAction('handover')}>Confirm handover</Button>}
        {borrowerCanReturn && <Button size="sm" onClick={() => setAction('return')}>I've returned it</Button>}
        {ownerCanConfirmReturn && <Button size="sm" onClick={() => setAction('confirm')}>{tx.status === 'RETURN_REQUESTED' ? 'Confirm return' : 'Mark as returned'}</Button>}
        {canReview && <Button size="sm" variant="soft" icon={<Star className="h-4 w-4" aria-hidden />} onClick={() => setReviewing(true)}>Leave a review</Button>}
        {tx.status === 'COMPLETED' && tx.myReviewSubmitted && <span className="inline-flex items-center gap-1 text-sm text-success"><Star className="h-4 w-4 fill-current" aria-hidden />You reviewed {other.name.split(' ')[0]}</span>}
        <Button size="sm" variant="ghost" icon={<MessageSquare className="h-4 w-4" aria-hidden />} loading={message.isPending} onClick={() => message.mutate({ recipientId: other.id, itemId: tx.item.id, requestId: tx.requestId })}>Message</Button>
      </div>

      {action && <ConfirmDialog open onClose={close} title={COPY[action].title} description={COPY[action].description} confirmLabel={COPY[action].confirm} loading={run.isPending} error={run.isError ? errorMessage(run.error) : undefined} onConfirm={() => run.mutate(action)} />}
      <ReviewDialog transactionId={tx.id} otherName={other.name} open={reviewing} onClose={() => setReviewing(false)} />
    </article>
  );
}
