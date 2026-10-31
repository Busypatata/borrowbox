import { useMutation } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/lib/utils';

export function VerifyBanner() {
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(),
    onSuccess: () => toast.success('If your address still needs verifying, a new link is on its way.'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[#E7CF9B] bg-[#FBF0D9] px-4 py-3 text-sm text-[#6B4A00]">
      <MailWarning className="h-5 w-5 shrink-0" aria-hidden />
      <p className="flex-1 min-w-[14rem]"><strong>Verify your email</strong> to list items and send borrowing requests. Check your inbox for the link.</p>
      <Button size="sm" variant="outline" loading={resend.isPending} onClick={() => resend.mutate()}>Resend email</Button>
    </div>
  );
}
