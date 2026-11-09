"use client";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api, realtimeAccessToken } from "@/shared/api/api";
import { cancelPushSetup, disableBrowserPush, optedIntoPush, registerBrowserPush } from "../push";
import type { InboxPage, PushConfig } from "../types";

const Context = createContext<{ inbox: InboxPage | null; error: string; revision: number; connected: boolean; pushState: string; busy: boolean;
  refresh(): Promise<void>; enablePush(): Promise<void>; disablePush(): Promise<void> }>(null!);
export const useNotifications = () => useContext(Context);

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [inbox, setInbox] = useState<InboxPage | null>(null); const [error, setError] = useState("");
  const [revision, setRevision] = useState(0); const [connected, setConnected] = useState(false);
  const [pushState, setPushState] = useState(""); const [busy, setBusy] = useState(false);
  const currentUser = useRef(user?.id); currentUser.current = user?.id;
  const requestId = useRef(0); const unsubscribe = useRef<(() => void) | null>(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    const id = ++requestId.current; const owner = user.id;
    try {
      const result = await api<InboxPage>("/api/notifications");
      if (currentUser.current === owner && requestId.current === id) { setInbox(result); setError(""); setRevision(x => x + 1); }
    } catch (ex) { if (currentUser.current === owner && requestId.current === id) setError((ex as Error).message); }
  }, [user]);
  const enablePush = async () => {
    setBusy(true); setPushState("");
    try {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
      const config = await api<PushConfig>("/api/notifications/config");
      unsubscribe.current?.(); unsubscribe.current = await registerBrowserPush(config, false);
      setPushState("Đã bật thông báo trình duyệt.");
    } catch (ex) { setPushState((ex as Error).message); }
    finally { setBusy(false); }
  };
  const disablePush = async () => { setBusy(true); try { unsubscribe.current?.(); unsubscribe.current = null; await disableBrowserPush(); setPushState("Đã tắt push cho phiên đăng nhập này."); } catch (ex) { setPushState((ex as Error).message); } finally { setBusy(false); } };
  useEffect(() => {
    setInbox(null); setError(""); setPushState("");
    if (!user) return;
    let disposed = false; let starting = false;
    const connection = new HubConnectionBuilder().withUrl("/hubs/notifications", {
      accessTokenFactory: realtimeAccessToken, headers: { "X-Requested-With": "GiveAid" }
    }).withAutomaticReconnect([0, 2000, 5000, 10000, 30000]).configureLogging(LogLevel.None).build();
    const update = () => { if (!disposed) void refresh(); };
    connection.on("notificationsChanged", update);
    connection.onreconnected(() => { if (!disposed) { setConnected(true); update(); } });
    connection.onreconnecting(() => { if (!disposed) setConnected(false); });
    connection.onclose(() => { if (!disposed) setConnected(false); });
    const start = async () => {
      if (disposed || starting || connection.state !== HubConnectionState.Disconnected) return;
      starting = true;
      try { await connection.start(); if (disposed) await connection.stop(); else { setConnected(true); update(); } } catch { /* Timer retries; REST inbox remains available. */ }
      finally { starting = false; }
    };
    update(); void start();
    const timer = setInterval(() => { void start(); update(); }, 30000);
    const visibility = () => { if (document.visibilityState === "visible") { update(); void start(); } };
    window.addEventListener("giveaid-notifications-changed", update);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", visibility);
    if (optedIntoPush() && "Notification" in window && Notification.permission === "granted") {
      void api<PushConfig>("/api/notifications/config").then(config => registerBrowserPush(config, false)).then(stop => {
        if (disposed) stop(); else { unsubscribe.current?.(); unsubscribe.current = stop; setPushState("Đã bật thông báo trình duyệt."); }
      }).catch(() => { if (!disposed) setPushState("Push chưa kết nối. Bạn có thể nhấn Bật thông báo để thử lại."); });
    }
    return () => {
      disposed = true; clearInterval(timer); setConnected(false); void connection.stop();
      cancelPushSetup();
      unsubscribe.current?.(); unsubscribe.current = null;
      window.removeEventListener("giveaid-notifications-changed", update); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", visibility);
    };
  }, [user, refresh]);
  return <Context.Provider value={{ inbox, error, revision, connected, pushState, busy, refresh, enablePush, disablePush }}>{children}</Context.Provider>;
}
