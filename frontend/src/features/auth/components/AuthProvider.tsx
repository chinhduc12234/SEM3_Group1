"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Account, acceptSession, api, forgetSession, refreshSession } from "@/shared/api/api";
import { disableBrowserPush } from "@/features/notifications/push";
const AuthContext = createContext<{
  user: Account | null;
  loading: boolean;
  login(email: string, password: string): Promise<Account>;
  logout(): Promise<void>;
  updateUser(user: Account): void;
}>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    refreshSession()
      .then((session) => setUser(session?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const expired = () => {
      forgetSession();
      setUser(null);
    };
    window.addEventListener("giveaid-session-expired", expired);
    return () => window.removeEventListener("giveaid-session-expired", expired);
  }, []);
  async function login(email: string, password: string) {
    const session = await api<{ accessToken: string; user: Account }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    acceptSession(session);
    setUser(session.user);
    return session.user;
  }
  async function logout() {
    await disableBrowserPush(true);
    const execute = async () => {
      await api("/api/auth/logout", { method: "POST" });
    };
    if ("locks" in navigator) await navigator.locks.request("giveaid-refresh", execute);
    else await execute();
    forgetSession();
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
