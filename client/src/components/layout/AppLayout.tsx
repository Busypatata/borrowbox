import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Gift, Heart, HandHeart, Home, Inbox, MessageSquare, Menu, Package, Plus, Search, Send, Settings, ShoppingBag, User, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usersApi } from '@/api/users.api';
import { qk } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { LinkButton } from '@/components/ui/Button';
import { AccountMenu } from '@/components/navigation/AccountMenu';
import { NotificationBell } from '@/components/navigation/NotificationBell';
import { VerifyBanner } from '@/features/auth/VerifyBanner';
import { Footer, PublicLayout } from './PublicLayout';

interface NavItem { to: string; label: string; icon: ReactNode; badge?: number }

export function useStats() {
  return useQuery({ queryKey: qk.stats, queryFn: usersApi.stats, refetchInterval: 20_000 });
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { data: s } = useStats();
  const sections: { title?: string; items: NavItem[] }[] = [
    { items: [
      { to: '/dashboard', label: 'Home', icon: <Home className="h-5 w-5" aria-hidden /> },
      { to: '/browse', label: 'Browse', icon: <ShoppingBag className="h-5 w-5" aria-hidden /> },
      { to: '/favorites', label: 'Wish List', icon: <Heart className="h-5 w-5" aria-hidden /> },
    ] },
    { title: 'Lending', items: [
      { to: '/my-items', label: 'My Items', icon: <Package className="h-5 w-5" aria-hidden /> },
      { to: '/requests/incoming', label: 'Incoming Requests', icon: <Inbox className="h-5 w-5" aria-hidden />, badge: s?.incomingPending },
      { to: '/lending', label: 'Lent Out', icon: <Gift className="h-5 w-5" aria-hidden /> },
    ] },
    { title: 'Borrowing', items: [
      { to: '/requests/outgoing', label: 'My Requests', icon: <Send className="h-5 w-5" aria-hidden /> },
      { to: '/borrowings', label: 'My Loans', icon: <HandHeart className="h-5 w-5" aria-hidden /> },
    ] },
    { items: [
      { to: '/messages', label: 'Messages', icon: <MessageSquare className="h-5 w-5" aria-hidden />, badge: s?.unreadMessages },
      { to: '/notifications', label: 'Notifications', icon: <Bell className="h-5 w-5" aria-hidden />, badge: s?.unreadNotifications },
      { to: '/profile', label: 'Profile', icon: <User className="h-5 w-5" aria-hidden /> },
      { to: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5" aria-hidden /> },
    ] },
  ];
  return (
    <nav aria-label="Main" className="space-y-4">
      {sections.map((sec, i) => (
        <div key={i}>
          {sec.title && <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-charcoal-70">{sec.title}</p>}
          <ul className="space-y-0.5">
            {sec.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.to === '/dashboard'}
                  onClick={onNavigate}
                  className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-pale text-burgundy' : 'hover:bg-blush/40')}
                >
                  {it.icon}
                  <span className="flex-1">{it.label}</span>
                  {!!it.badge && it.badge > 0 && <span aria-label={`${it.badge} new`} className="grid min-h-5 min-w-5 place-items-center rounded-full bg-burgundy px-1.5 text-xs font-bold text-white">{it.badge > 99 ? '99+' : it.badge}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function TopSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form role="search" className="relative hidden max-w-md flex-1 sm:block" onSubmit={(e) => { e.preventDefault(); navigate(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-70" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" placeholder="Search for books, electronics, or games…" className="w-full rounded-xl border border-blush bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-charcoal-70/70" />
    </form>
  );
}

/** Signed-in shell: sidebar on desktop, drawer on mobile. */
export function AppLayout({ children }: { children?: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 overflow-y-auto border-r border-blush/70 bg-white/80 p-5 lg:block">
        <Logo to="/dashboard" className="mb-6" />
        <SidebarNav />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-charcoal/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white p-5 shadow-pop">
            <div className="mb-6 flex items-center justify-between">
              <Logo to="/dashboard" />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-blush/50"><X className="h-5 w-5" aria-hidden /></button>
            </div>
            <SidebarNav onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-blush/60 bg-ivory/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button type="button" className="rounded-xl p-2.5 hover:bg-blush/50 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu className="h-5 w-5" aria-hidden /></button>
            <TopSearch />
            <div className="ml-auto flex items-center gap-2">
              <LinkButton to="/items/new" size="sm" icon={<Plus className="h-4 w-4" aria-hidden />}><span className="hidden sm:inline">List an item</span><span className="sm:hidden">List</span></LinkButton>
              <NotificationBell />
              <AccountMenu />
            </div>
          </div>
        </header>
        <main id="main" className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-6xl">
            {user && !user.emailVerified && <VerifyBanner />}
            {children ?? <Outlet />}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

/** Public pages that are also useful inside the app (browse, item detail, help…). */
export function AdaptiveLayout({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  return user ? <AppLayout>{children}</AppLayout> : <PublicLayout>{children}</PublicLayout>;
}
