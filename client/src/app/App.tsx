import { useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { setSessionExpiredHandler } from '@/api/client';
import { qk } from '@/lib/queryKeys';
import { queryClient } from './query-client';
import { createRouter } from './router';

export default function App() {
  const router = useMemo(() => createRouter(), []);
  useEffect(() => {
    // An authenticated request got a 401: the session expired or was revoked elsewhere.
    setSessionExpiredHandler(() => {
      queryClient.clear(); // drop cached private data
      queryClient.setQueryData(qk.me, { user: null, csrfToken: null });
      toast.info('Your session has expired. Please sign in again.');
    });
    return () => setSessionExpiredHandler(null);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" closeButton toastOptions={{ classNames: { toast: 'font-sans' } }} />
    </QueryClientProvider>
  );
}
