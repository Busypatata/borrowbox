import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('h-8 w-8', className)}>
      <rect width="32" height="32" rx="8" fill="#773B49" />
      <path d="M16 6l9 4.5v11L16 26l-9-4.5v-11L16 6z" fill="none" stroke="#FAF6F5" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 10.5l9 4.5 9-4.5M16 15v11" fill="none" stroke="#FAF6F5" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} aria-label="BorrowBox home" className={cn('inline-flex items-center gap-2 rounded-lg', className)}>
      <LogoMark />
      <span className="font-display text-xl font-semibold text-burgundy">BorrowBox</span>
    </Link>
  );
}
