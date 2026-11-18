"use client";
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Account, acceptSession, api, forgetSession, onSessionEnded, refreshSession, withSessionLock } from "@/shared/api/api";
import { disableBrowserPush } from "@/features/notifications/push";

const AuthContext = createContext<{
  user: Account | null;
  loading: boolean;
  sessionUnavailable: boolean;
  retrySession(): void;
  login(email: string, password: string): Promise<Account>;
  logout(): Promise<void>;
  updateUser(user: Account): void;
}>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [sessionCheck, setSessionCheck] = useState(0);
  const revision = useRef(0);

  function retrySession() {
    setLoading(true);
    setSessionUnavailable(false);
    setSessionCheck((value) => value + 1);
  }

  useEffect(() => {
    const currentRevision = revision.current;
    let active = true;
    const current = () => active && currentRevision === revision.current;
    refreshSession()
      .then((session) => { if (current()) setUser(session?.user ?? null); })
      .catch(() => { if (current()) setSessionUnavailable(true); })
      .finally(() => { if (current()) setLoading(false); });
    return () => { active = false; };
  }, [sessionCheck]);

  useEffect(() => onSessionEnded(() => {
    revision.current++;
    setUser(null);
    setLoading(false);
    setSessionUnavailable(false);
  }), []);

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) retrySession(); };
    const online = () => { if (sessionUnavailable) retrySession(); };
    window.addEventListener("pageshow", restore);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("online", online);
    };
  }, [sessionUnavailable]);

  async function login(email: string, password: string) {
    return withSessionLock(async () => {
      const session = await api<{ accessToken: string; user: Account }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      revision.current++;
      acceptSession(session);
      setSessionUnavailable(false);
      setLoading(false);
      setUser(session.user);
      return session.user;
    });
  }
  async function logout() {
    await disableBrowserPush(true);
    await withSessionLock(async () => {
      await api("/api/auth/logout", { method: "POST" });
      forgetSession();
    });
  }
  return (
    <AuthContext.Provider value={{ user, loading, sessionUnavailable, retrySession, login, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
