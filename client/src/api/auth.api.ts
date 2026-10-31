import type { LoginInput, Me, RegisterInput } from '@borrowbox/shared';
import { api, setCsrfToken } from './client';

export interface Session {
  user: Me | null;
  csrfToken: string | null;
}

export const authApi = {
  async me(): Promise<Session> {
    const s = await api.get<Session>('/auth/me');
    setCsrfToken(s.csrfToken);
    return s;
  },
  async login(input: LoginInput): Promise<Session> {
    const s = await api.post<Session>('/auth/login', input);
    setCsrfToken(s.csrfToken);
    return s;
  },
  register: (input: RegisterInput) => api.post<{ message: string }>('/auth/register', input),
  async logout() {
    await api.post('/auth/logout');
    setCsrfToken(null);
  },
  async logoutAll() {
    await api.post('/auth/logout-all');
    setCsrfToken(null);
  },
  forgotPassword: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (input: { token: string; password: string; confirmPassword: string }) =>
    api.post<{ message: string }>('/auth/reset-password', input),
  verifyEmail: (token: string) => api.post<{ message: string }>('/auth/verify-email', { token }),
  resendVerification: (email?: string) => api.post<{ message: string }>('/auth/resend-verification', email ? { email } : {}),
  changePassword: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    api.post<{ message: string }>('/auth/change-password', input),
};
