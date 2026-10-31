import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { cn, errorMessage } from '@/lib/utils';
import { Button } from './Button';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('skeleton', className)} />;

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('card flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-pale text-mist-700">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</div>
      <h2 className="font-display text-xl">{title}</h2>
      {body && <p className="max-w-md text-sm text-charcoal-70">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const network = error instanceof ApiError && error.isNetwork;
  return (
    <div role="alert" className={cn('card flex flex-col items-center gap-3 border-danger/30 px-6 py-10 text-center', className)}>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-danger"><AlertTriangle className="h-6 w-6" aria-hidden /></div>
      <h2 className="font-display text-xl">{network ? "Can't connect" : 'Something went wrong'}</h2>
      <p className="max-w-md text-sm text-charcoal-70">{errorMessage(error)}</p>
      {onRetry && <Button variant="outline" icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function InlineError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{children}</p>;
}

export function InlineNotice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warn' }) {
  const tones = { info: 'bg-pale text-charcoal', success: 'bg-success-soft text-success', warn: 'bg-[#FBF0D9] text-[#6B4A00]' };
  return <p role="status" className={cn('rounded-xl px-3.5 py-2.5 text-sm', tones[tone])}>{children}</p>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div role="status" aria-label={label} className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blush border-t-burgundy" />;
}
