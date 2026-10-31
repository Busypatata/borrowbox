import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/ui/Logo';
import { LinkButton } from '@/components/ui/Button';
import { AccountMenu } from '@/components/navigation/AccountMenu';
import { NotificationBell } from '@/components/navigation/NotificationBell';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/browse', label: 'Browse' },
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/about', label: 'About' },
];

export function PublicHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const link = ({ isActive }: { isActive: boolean }) => cn('rounded-lg px-3 py-2 text-sm font-medium hover:bg-blush/50', isActive && 'text-burgundy');
  return (
    <header className="sticky top-0 z-30 border-b border-blush/60 bg-ivory/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {nav.map((n) => <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>)}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <LinkButton to="/dashboard" variant="outline" size="sm" className="hidden sm:inline-flex">Dashboard</LinkButton>
              <NotificationBell />
              <AccountMenu />
            </>
          ) : (
            <>
              <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold hover:bg-blush/50 sm:block">Sign In</Link>
              <LinkButton to="/signup" variant="accent" size="sm">Get Started</LinkButton>
            </>
          )}
          <button type="button" className="rounded-xl p-2.5 hover:bg-blush/50 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-blush/60 bg-ivory px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {nav.map((n) => <li key={n.to}><NavLink to={n.to} className={link} onClick={() => setOpen(false)}>{n.label}</NavLink></li>)}
            {!user && <li><NavLink to="/login" className={link} onClick={() => setOpen(false)}>Sign In</NavLink></li>}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const col = 'text-sm text-charcoal-70 hover:text-burgundy hover:underline';
  return (
    <footer className="mt-16 border-t border-blush/70 bg-white/60">
      <div className="container-page flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-charcoal-70">Borrow more. Buy less.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link className={col} to="/about">About</Link>
          <Link className={col} to="/help">Help</Link>
          <Link className={col} to="/terms">Terms</Link>
          <Link className={col} to="/privacy">Privacy</Link>
          <Link className={col} to="/help#contact">Contact</Link>
        </nav>
      </div>
      <p className="container-page pb-6 text-xs text-charcoal-70">© {new Date().getFullYear()} BorrowBox. Made for communities that share.</p>
    </footer>
  );
}

export function PublicLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <PublicHeader />
      <main id="main" className="flex-1">{children ?? <Outlet />}</main>
      <Footer />
    </div>
  );
}
