import type { AuthResponse } from '../types';

let accessToken: string | null = null;
let refreshPromise: Promise<AuthResponse> | null = null;
let onSession: (session: AuthResponse | null) => void = () => {};
export function setSessionListener(listener: typeof onSession) { onSession = listener; }
export function setToken(token: string | null) { accessToken = token; }

export async function refreshSession(): Promise<AuthResponse> {
  if (!refreshPromise) refreshPromise = request<AuthResponse>('/auth/refresh', { method: 'POST' }, false)
    .then(session => { accessToken = session.accessToken; onSession(session); return session; })
    .catch(error => { accessToken = null; onSession(null); throw error; })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}
export async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'SEM3');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' });
  if (response.status === 401 && retry && accessToken && !path.startsWith('/auth/')) {
    await refreshSession();
    return request<T>(path, options, false);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const errors = data.errors ? Object.values(data.errors).flat().join(' ') : '';
    throw new Error(errors || data.title || (response.status === 429 ? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' : 'Không thể kết nối dịch vụ. Vui lòng thử lại.'));
  }
  return response.status === 204 ? undefined as T : response.json();
}
