import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicHeader } from '@/components/layout/PublicLayout';
import { Pagination } from '@/components/ui/Misc';
import { renderWithProviders, testUser } from './helpers';

vi.mock('@/api/notifications.api', () => ({ notificationsApi: { unreadCount: vi.fn(async () => ({ count: 0 })), list: vi.fn(async () => ({ data: [], meta: {} })) } }));
vi.mock('@/api/conversations.api', () => ({ conversationsApi: { unreadCount: vi.fn(async () => ({ count: 0 })), list: vi.fn(async () => ({ data: [], meta: {} })) } }));
vi.mock('@/api/auth.api', () => ({ authApi: { me: vi.fn(async () => ({ user: null, csrfToken: null })) } }));

describe('navigation', () => {
  it('app shell exposes a labelled primary nav with the core destinations', async () => {
    renderWithProviders(<AppLayout />, { user: testUser, route: '/dashboard' });
    const navs = await screen.findAllByRole('navigation');
    expect(navs.length).toBeGreaterThan(0);
    for (const name of [/home|dashboard/i, /browse/i, /messages/i, /wish list/i]) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
  });
  it('public header offers sign in / sign up to anonymous visitors', () => {
    renderWithProviders(<PublicHeader />, { user: null });
    expect(screen.getAllByRole('link', { name: /sign in|log in/i }).length).toBeGreaterThan(0);
  });
  it('mobile menu control is a labelled button', async () => {
    renderWithProviders(<AppLayout />, { user: testUser });
    expect(await screen.findByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = renderWithProviders(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container.querySelector('nav')).toBeNull();
  });
  it('disables Previous on page one', () => {
    renderWithProviders(<Pagination page={1} totalPages={3} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });
});
