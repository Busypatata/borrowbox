import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from '@borrowbox/shared';
import { reportsApi } from '@/api/reports.api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SelectField, TextArea } from '@/components/ui/Field';
import { InlineError } from '@/components/ui/Feedback';
import { errorMessage } from '@/lib/utils';

export function ReportDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: { itemId?: string; userId?: string; label: string } }) {
  const [reason, setReason] = useState<ReportReason>('SPAM_OR_MISLEADING');
  const [details, setDetails] = useState('');
  const m = useMutation({
    mutationFn: () => reportsApi.create({ itemId: target.itemId, userId: target.userId, reason, details: details.trim() || undefined }),
    onSuccess: () => { toast.success('Thanks — our team will review your report.'); setDetails(''); onClose(); },
  });
  return (
    <Modal open={open} onClose={onClose} title={`Report ${target.label}`} description="Tell us what's wrong. Reports are reviewed by moderators and are never shared with the other member."
      footer={<><Button variant="ghost" onClick={onClose} disabled={m.isPending}>Cancel</Button><Button variant="danger" loading={m.isPending} onClick={() => m.mutate()}>Submit report</Button></>}>
      <div className="space-y-4">
        {m.isError && <InlineError>{errorMessage(m.error)}</InlineError>}
        <SelectField label="Reason" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => <option key={r} value={r}>{REPORT_REASON_LABELS[r]}</option>)}
        </SelectField>
        <TextArea label="Details (optional)" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
    </Modal>
  );
}
