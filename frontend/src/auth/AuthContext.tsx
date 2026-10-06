import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { refreshSession, request, setSessionListener, setToken } from '../lib/api';
import type { AuthResponse, User } from '../types';

type Auth = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setSessionListener(session => setUser(session?.user ?? null));
    refreshSession().catch(() => {}).finally(() => setLoading(false));
    return () => setSessionListener(() => {});
  }, []);
  async function login(email: string, password: string) {
    const session = await request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(session.accessToken); setUser(session.user);
  }
  async function logout() {
    await request('/auth/logout', { method: 'POST' });
    setToken(null); setUser(null);
  }
  return <Context.Provider value={{ user, loading, login, logout }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('Missing AuthProvider'); return value; }
