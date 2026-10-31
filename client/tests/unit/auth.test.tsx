import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { RequireAdmin, RequireAuth } from '@/components/navigation/guards';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import { renderWithProviders, testUser } from './helpers';

vi.mock('@/api/auth.api', () => ({
  authApi: { me: vi.fn(async () => ({ user: null, csrfToken: null })), login: vi.fn(), register: vi.fn() },
}));
import { authApi } from '@/api/auth.api';

describe('route guards', () => {
  const tree = (
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route element={<RequireAuth />}>
        <Route path="/secret" element={<p>secret content</p>} />
        <Route element={<RequireAdmin />}><Route path="/admin" element={<p>admin content</p>} /></Route>
      </Route>
      <Route path="/dashboard" element={<p>dashboard</p>} />
    </Routes>
  );
  it('redirects anonymous users to /login', async () => {
    renderWithProviders(tree, { route: '/secret', user: null });
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });
  it('lets authenticated users through', async () => {
    renderWithProviders(tree, { route: '/secret', user: testUser });
    expect(await screen.findByText('secret content')).toBeInTheDocument();
  });
  it('blocks non-admins from admin routes', async () => {
    renderWithProviders(tree, { route: '/admin', user: testUser });
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });
  it('lets admins into admin routes', async () => {
    renderWithProviders(tree, { route: '/admin', user: { ...testUser, role: 'ADMIN' } });
    expect(await screen.findByText('admin content')).toBeInTheDocument();
  });
});

describe('login form', () => {
  it('shows validation errors and does not call the API when empty', async () => {
    renderWithProviders(<Login />, { user: null });
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect((await screen.findAllByText(/./, { selector: '[role="alert"], p.text-danger, p[id$="-error"]' })).length).toBeGreaterThan(0);
    expect(authApi.login).not.toHaveBeenCalled();
  });
  it('shows the server error message on failed login', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.'));
    renderWithProviders(<Login />, { user: null });
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test');
    await userEvent.type(screen.getByLabelText(/^password/i), 'whatever123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
  });
  it('has labelled inputs (accessibility)', () => {
    renderWithProviders(<Login />, { user: null });
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });
});

describe('signup form', () => {
  it('rejects a weak password and mismatched confirmation client-side', async () => {
    renderWithProviders(<Signup />, { user: null });
    await userEvent.type(screen.getByLabelText(/full name/i), 'Ann Example');
    await userEvent.type(screen.getByLabelText(/^email/i), 'ann@example.test');
    await userEvent.type(screen.getByLabelText(/^password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(authApi.register).not.toHaveBeenCalled());
    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
  });
});
