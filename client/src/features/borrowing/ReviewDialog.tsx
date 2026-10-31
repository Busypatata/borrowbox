import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LIMITS } from '@borrowbox/shared';
import { reviewsApi } from '@/api/reviews.api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { InlineError } from '@/components/ui/Feedback';
import { StarInput } from '@/components/ui/Misc';
import { errorMessage } from '@/lib/utils';
import { useInvalidateBorrowing } from './hooks';

export function ReviewDialog({ transactionId, otherName, open, onClose }: { transactionId: string; otherName: string; open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const invalidate = useInvalidateBorrowing();
  const m = useMutation({
    mutationFn: () => reviewsApi.create(transactionId, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => { toast.success('Review submitted — thank you!'); invalidate(); setRating(0); setComment(''); onClose(); },
  });
  return (
    <Modal open={open} onClose={onClose} title={`Review ${otherName}`} description="Your review is public on their profile."
      footer={<><Button variant="ghost" onClick={onClose} disabled={m.isPending}>Cancel</Button><Button loading={m.isPending} disabled={rating === 0} onClick={() => m.mutate()}>Submit review</Button></>}>
      <div className="space-y-4">
        {m.isError && <InlineError>{errorMessage(m.error)}</InlineError>}
        <div><p className="mb-1 text-sm font-medium">Rating</p><StarInput value={rating} onChange={setRating} label={`Rating for ${otherName}`} /></div>
        <TextArea label="Comment (optional)" maxLength={LIMITS.REVIEW_MAX} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
    </Modal>
  );
}
