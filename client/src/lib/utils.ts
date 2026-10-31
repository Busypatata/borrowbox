import { CATEGORIES, CONDITION_LABELS, type Condition } from '@borrowbox/shared';
import { ApiError } from '@/api/client';

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const categoryLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
export const conditionLabel = (c: Condition) => CONDITION_LABELS[c] ?? c;

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  // Date-only strings are treated as UTC calendar days (the app-wide policy) so they never shift by timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : undefined, ...opts }).format(d);
}
export const formatRange = (start: string, end: string) =>
  start === end ? formatDate(start) : `${formatDate(start, { day: 'numeric', month: 'short' })} – ${formatDate(end)}`;

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso, { day: 'numeric', month: 'short' });
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
