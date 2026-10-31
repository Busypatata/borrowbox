import type { ApiMeta } from '@borrowbox/shared';

export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork() {
    return this.status === 0;
  }
}

/** CSRF token lives in memory only (never localStorage); it is re-fetched from /auth/me on page load. */
let csrfToken: string | null = null;
export const setCsrfToken = (t: string | null) => {
  csrfToken = t;
};

let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  onSessionExpired = fn;
};

type Query = Record<string, string | number | boolean | null | undefined>;
interface Options {
  query?: Query;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}
export interface Page<T> {
  data: T;
  meta: ApiMeta;
}

function qs(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: string, path: string, opts: Options = {}): Promise<Page<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => controller.abort(opts.signal?.reason));

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs(opts.query)}`, {
      method,
      credentials: 'include',
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError' && opts.signal?.aborted) throw err; // caller cancelled
    const timeout = (err as Error).name === 'TimeoutError' || controller.signal.reason?.name === 'TimeoutError';
    throw new ApiError(
      0,
      timeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      timeout ? 'The request took too long. Please try again.' : "We can't reach BorrowBox right now. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return { data: undefined as T, meta: {} };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', 'Received an unexpected response from the server.');
  }
  const body = json as { success?: boolean; data?: T; meta?: ApiMeta; error?: { code: string; message: string; fields?: Record<string, string> } };

  if (!res.ok || body.success === false) {
    const e = body.error;
    const err = new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong.', e?.fields);
    if (res.status === 401 && csrfToken && path !== '/auth/login') onSessionExpired?.();
    throw err;
  }
  if (body.success !== true || !('data' in body)) {
    throw new ApiError(res.status, 'BAD_RESPONSE', 'Received an unexpected response from the server.');
  }
  return { data: body.data as T, meta: body.meta ?? {} };
}

export const api = {
  get: async <T>(path: string, query?: Query, signal?: AbortSignal) => (await request<T>('GET', path, { query, signal })).data,
  getPage: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: async <T>(path: string, body?: unknown) => (await request<T>('POST', path, { body: body ?? {} })).data,
  patch: async <T>(path: string, body?: unknown) => (await request<T>('PATCH', path, { body: body ?? {} })).data,
  delete: async <T = void>(path: string, body?: unknown) => (await request<T>('DELETE', path, { body })).data,
  upload: async <T>(path: string, form: FormData) => (await request<T>('POST', path, { form })).data,
};
