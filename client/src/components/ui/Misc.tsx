import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RequestStatus, TransactionStatus } from '@borrowbox/shared';
import { cn, initials } from '@/lib/utils';
import { Button } from './Button';

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  return src ? (
    <img src={src} alt="" loading="lazy" style={style} className={cn('shrink-0 rounded-full object-cover', className)} />
  ) : (
    <span aria-hidden style={style} className={cn('grid shrink-0 place-items-center rounded-full bg-blush font-semibold text-burgundy', className)}>{initials(name)}</span>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info' | 'brand'; className?: string }) {
  const tones = {
    neutral: 'bg-blush/60 text-charcoal',
    success: 'bg-success-soft text-success',
    warn: 'bg-[#FBF0D9] text-[#6B4A00]',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-pale text-[#2F5A87]',
    brand: 'bg-burgundy text-white',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

const REQ: Record<RequestStatus, { label: string; tone: 'warn' | 'success' | 'danger' | 'neutral' | 'info' }> = {
  PENDING: { label: 'Pending', tone: 'warn' },
  APPROVED: { label: 'Approved', tone: 'success' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  COMPLETED: { label: 'Completed', tone: 'info' },
};
export const RequestStatusBadge = ({ status }: { status: RequestStatus }) => <Badge tone={REQ[status].tone}>{REQ[status].label}</Badge>;

const TX: Record<TransactionStatus, { label: string; tone: 'warn' | 'success' | 'danger' | 'neutral' | 'info' }> = {
  AWAITING_HANDOVER: { label: 'Awaiting handover', tone: 'warn' },
  BORROWED: { label: 'Borrowed', tone: 'info' },
  RETURN_REQUESTED: { label: 'Return requested', tone: 'warn' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
export const TransactionStatusBadge = ({ status }: { status: TransactionStatus }) => <Badge tone={TX[status].tone}>{TX[status].label}</Badge>;
export const txStatusLabel = (s: TransactionStatus) => TX[s].label;

/** Shows stars + number; with no reviews it says so rather than showing a fabricated rating. */
export function RatingSummary({ average, count, className }: { average: number | null; count: number; className?: string }) {
  if (average === null || count === 0) return <span className={cn('text-sm text-charcoal-70', className)}>No reviews yet</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Star className="h-4 w-4 fill-[#E0A93B] text-[#E0A93B]" aria-hidden />
      <span className="font-semibold">{average.toFixed(1)}</span>
      <span className="text-charcoal-70">({count} {count === 1 ? 'review' : 'reviews'})</span>
    </span>
  );
}

export function StarInput({ value, onChange, label = 'Rating' }: { value: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="rounded-md p-1">
          <Star className={cn('h-7 w-7', n <= value ? 'fill-[#E0A93B] text-[#E0A93B]' : 'text-blush')} aria-hidden />
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const nums: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 pt-4">
      <Button variant="ghost" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} aria-hidden className="px-1 text-charcoal-70">…</span>
        ) : (
          <button key={n} type="button" aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)} className={cn('h-9 min-w-9 rounded-lg px-2 text-sm font-semibold', n === page ? 'bg-mist-700 text-white' : 'hover:bg-blush/50')}>{n}</button>
        ),
      )}
      <Button variant="ghost" size="sm" aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><ChevronRight className="h-4 w-4" aria-hidden /></Button>
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-charcoal-70">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn('whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', value === t.id ? 'bg-burgundy text-white' : 'bg-white text-charcoal hover:bg-blush/50')}>
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className={cn('ml-1.5 rounded-full px-1.5 text-xs', value === t.id ? 'bg-white/25' : 'bg-blush')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
