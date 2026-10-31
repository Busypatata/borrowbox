import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { qk } from '@/lib/queryKeys';

export const testUser = { id: 'u1', name: 'Test User', email: 't@x.test', role: 'USER', emailVerified: true, profileImageUrl: null, latitude: null, longitude: null };

export function renderWithProviders(ui: ReactElement, opts: { route?: string; user?: typeof testUser | null; routes?: { path: string; element: ReactElement }[] } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (opts.user !== undefined) qc.setQueryData(qk.me, { user: opts.user, csrfToken: 'csrf' });
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[opts.route ?? '/']}>
        <Routes>
          <Route path="*" element={ui} />
          {opts.routes?.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { qc, ...utils };
}
