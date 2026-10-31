import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { DATE_RANGE_MESSAGES, LIMITS, rangesOverlap, todayUtc, validateDateRange, type ItemDetail } from '@borrowbox/shared';
import { requestsApi } from '@/api/requests.api';
import { qk } from '@/lib/queryKeys';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { InlineError } from '@/components/ui/Feedback';
import { errorMessage, formatRange } from '@/lib/utils';

export function BorrowRequestForm({ item }: { item: ItemDetail }) {
  const qc = useQueryClient();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [message, setMessage] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const problem = useMemo(() => {
    if (!start || !end) return null;
    const e = validateDateRange(start, end);
    if (e) return DATE_RANGE_MESSAGES[e];
    if (item.bookedRanges.some((r) => rangesOverlap(r, { startDate: start, endDate: end }))) return 'This item is already booked for some of those dates.';
    return null;
  }, [start, end, item.bookedRanges]);
  const ready = Boolean(start && end && !problem);

  const m = useMutation({
    mutationFn: () => requestsApi.create({ itemId: item.id, startDate: start, endDate: end, message }),
    onSuccess: () => {
      toast.success('Request sent! The owner has been notified.');
      void qc.invalidateQueries({ queryKey: qk.item(item.id) });
      void qc.invalidateQueries({ queryKey: qk.requestsAll });
      void qc.invalidateQueries({ queryKey: qk.stats });
    },
    onError: () => setReviewing(false), // keep all inputs so the user can adjust and retry
  });

  if (reviewing) {
    return (
      <div className="space-y-4">
        <h3 className="font-sans text-base font-semibold">Review your request</h3>
        <dl className="space-y-2 rounded-xl bg-pale/50 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-charcoal-70">Item</dt><dd className="text-right font-medium">{item.title}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-charcoal-70">Dates</dt><dd className="text-right font-medium">{formatRange(start, end)}</dd></div>
          {message && <div><dt className="text-charcoal-70">Message</dt><dd className="mt-1 whitespace-pre-wrap">{message}</dd></div>}
        </dl>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" disabled={m.isPending} onClick={() => setReviewing(false)}>Edit</Button>
          <Button variant="accent" className="flex-1" loading={m.isPending} onClick={() => m.mutate()}>Send request</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); if (ready) setReviewing(true); }}>
      {m.isError && <InlineError>{errorMessage(m.error)}</InlineError>}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Start date" type="date" required min={todayUtc()} value={start} onChange={(e) => { setStart(e.target.value); if (!end || e.target.value > end) setEnd(e.target.value); }} />
        <TextField label="End date" type="date" required min={start || todayUtc()} value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {problem && <p role="alert" className="text-sm font-medium text-danger">{problem}</p>}
      <p className="flex items-center gap-1.5 text-xs text-charcoal-70"><CalendarDays className="h-3.5 w-3.5" aria-hidden />Up to {LIMITS.MAX_BOOKING_DAYS} days per request.</p>
      <TextArea label="Message to owner (optional)" maxLength={500} className="min-h-20" placeholder="Say hi and mention what you'll use it for." value={message} onChange={(e) => setMessage(e.target.value)} />
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={!ready}>Review request</Button>
    </form>
  );
}
