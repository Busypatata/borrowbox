import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { GuestOnly, RequireAdmin, RequireAuth } from '@/components/navigation/guards';
import { ScrollManager } from '@/hooks/misc';
import { Spinner } from '@/components/ui/Feedback';

// Route-level code splitting: each page is its own chunk.
const lazyPage = <T extends { [k: string]: unknown }>(load: () => Promise<T>, pick: keyof T = 'default'): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load())[pick] as React.ComponentType }),
});

const Root = () => (<><ScrollManager /><Outlet /></>);
export const RouteFallback = () => <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>;

export const routes: RouteObject[] = [
  {
    element: <Root />,
    hydrateFallbackElement: <RouteFallback />,
    children: [
      { path: '/', ...lazyPage(() => import('@/pages/Landing')) },
      { path: '/browse', ...lazyPage(() => import('@/pages/Browse')) },
      { path: '/items/:itemId', ...lazyPage(() => import('@/pages/ItemDetail')) },
      { path: '/about', ...lazyPage(() => import('@/pages/Static'), 'About') },
      { path: '/help', ...lazyPage(() => import('@/pages/Static'), 'Help') },
      { path: '/terms', ...lazyPage(() => import('@/pages/Static'), 'Terms') },
      { path: '/privacy', ...lazyPage(() => import('@/pages/Static'), 'Privacy') },
      { path: '/verify-email', ...lazyPage(() => import('@/pages/VerifyEmail')) },
      { path: '/reset-password', ...lazyPage(() => import('@/pages/ResetPassword')) },
      { path: '/forgot-password', ...lazyPage(() => import('@/pages/ForgotPassword')) },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', ...lazyPage(() => import('@/pages/Login')) },
          { path: '/signup', ...lazyPage(() => import('@/pages/Signup')) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/dashboard', ...lazyPage(() => import('@/pages/Dashboard')) },
              { path: '/my-items', ...lazyPage(() => import('@/pages/MyItems')) },
              { path: '/items/new', ...lazyPage(() => import('@/pages/ItemForm')) },
              { path: '/items/:itemId/edit', ...lazyPage(() => import('@/pages/ItemForm')) },
              { path: '/requests/incoming', lazy: async () => { const { default: R } = await import('@/pages/Requests'); return { Component: () => <R side="incoming" /> }; } },
              { path: '/requests/outgoing', lazy: async () => { const { default: R } = await import('@/pages/Requests'); return { Component: () => <R side="outgoing" /> }; } },
              { path: '/borrowings', lazy: async () => { const { default: L } = await import('@/pages/Loans'); return { Component: () => <L role="BORROWER" /> }; } },
              { path: '/lending', lazy: async () => { const { default: L } = await import('@/pages/Loans'); return { Component: () => <L role="OWNER" /> }; } },
              { path: '/messages', ...lazyPage(() => import('@/pages/Messages')) },
              { path: '/messages/:conversationId', ...lazyPage(() => import('@/pages/Messages')) },
              { path: '/notifications', ...lazyPage(() => import('@/pages/Notifications')) },
              { path: '/favorites', ...lazyPage(() => import('@/pages/Favorites')) },
              { path: '/profile', ...lazyPage(() => import('@/pages/Profile')) },
              { path: '/users/:userId', ...lazyPage(() => import('@/pages/Profile')) },
              {
                path: '/settings',
                ...lazyPage(() => import('@/pages/Settings'), 'SettingsLayout'),
                children: [
                  { index: true, ...lazyPage(() => import('@/pages/Settings'), 'ProfileSettings') },
                  { path: 'security', ...lazyPage(() => import('@/pages/Settings'), 'SecuritySettings') },
                  { path: 'notifications', ...lazyPage(() => import('@/pages/Settings'), 'NotificationSettings') },
                ],
              },
              { element: <RequireAdmin />, children: [{ path: '/admin/reports', ...lazyPage(() => import('@/pages/AdminReports')) }] },
            ],
          },
        ],
      },
      { path: '*', ...lazyPage(() => import('@/pages/NotFound')) },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
