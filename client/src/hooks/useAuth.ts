import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput } from '@borrowbox/shared';
import { authApi, type Session } from '@/api/auth.api';
import { qk } from '@/lib/queryKeys';

export function useAuth() {
  const q = useQuery({ queryKey: qk.me, queryFn: authApi.me, staleTime: 60_000, retry: false });
  return { user: q.data?.user ?? null, isLoading: q.isLoading, error: q.error, refetch: q.refetch };
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (session: Session) => {
      qc.clear(); // never show another user's cached data
      qc.setQueryData(qk.me, session);
    },
  });
}

export function useLogout(all = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => (all ? authApi.logoutAll() : authApi.logout()),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(qk.me, { user: null, csrfToken: null } satisfies Session);
    },
  });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.me });
}
