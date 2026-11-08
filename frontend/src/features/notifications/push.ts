"use client";
import { api } from "@/shared/api/api";
import type { PushConfig } from "./types";

let activeMessaging: import("firebase/messaging").Messaging | null = null;
let operation = 0;
export function cancelPushSetup() { operation++; }
export const optedIntoPush = () => { try { return localStorage.getItem("giveaid-push-opt-in") === "true"; } catch { return false; } };
function rememberPush(value: boolean) { try { localStorage.setItem("giveaid-push-opt-in", String(value)); } catch { /* Storage may be disabled. */ } }
async function pushLock<T>(work: () => Promise<T>): Promise<T> {
  return "locks" in navigator ? navigator.locks.request("giveaid-push-registration", work) : work();
}

export function registerBrowserPush(config: PushConfig, requestPermission: boolean) {
  const attempt = ++operation;
  return pushLock(() => register(config, requestPermission, attempt));
}
async function register(config: PushConfig, requestPermission: boolean, attempt: number) {
  if (attempt !== operation) return () => {};
  if (!config.enabled) throw new Error("Thông báo đẩy chưa được cấu hình.");
  const sdk = await import("firebase/messaging");
  if (!window.isSecureContext || !await sdk.isSupported()) throw new Error("Trình duyệt này chưa hỗ trợ push. Chuông trong website vẫn hoạt động.");
  const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error("Bạn cần cho phép thông báo trong cài đặt trình duyệt.");
  const { initializeApp, getApps } = await import("firebase/app");
  const app = getApps().find(x => x.name === "giveaid-notifications") ?? initializeApp(config.firebase, "giveaid-notifications");
  activeMessaging = sdk.getMessaging(app);
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js?" + new URLSearchParams({ config: JSON.stringify(config.firebase) }), { scope: "/firebase-push/" });
  if (!registration.active) await new Promise<void>((resolve, reject) => {
    const worker = registration.installing || registration.waiting;
    if (!worker) { reject(new Error("Không khởi động được dịch vụ push.")); return; }
    const timer = setTimeout(() => reject(new Error("Khởi động push quá thời gian. Vui lòng thử lại.")), 20000);
    const changed = () => {
      if (worker.state === "activated") { clearTimeout(timer); worker.removeEventListener("statechange", changed); resolve(); }
      if (worker.state === "redundant") { clearTimeout(timer); worker.removeEventListener("statechange", changed); reject(new Error("Không cài được dịch vụ push.")); }
    };
    worker.addEventListener("statechange", changed); changed();
  });
  const token = await sdk.getToken(activeMessaging, { vapidKey: config.vapidPublicKey, serviceWorkerRegistration: registration });
  if (attempt !== operation) return () => {};
  if (!token) throw new Error("Chưa lấy được token push. Vui lòng thử lại.");
  await api("/api/notifications/push-subscriptions", { method: "POST", body: JSON.stringify({ token }) });
  if (attempt !== operation) return () => {};
  rememberPush(true);
  return sdk.onMessage(activeMessaging, () => window.dispatchEvent(new Event("giveaid-notifications-changed")));
}

export async function disableBrowserPush(forLogout = false) {
  cancelPushSetup();
  if (!forLogout) rememberPush(false);
  return pushLock(async () => {
    let serverRevoked = false, browserRevoked = false;
    try { await api("/api/notifications/push-subscriptions/current-session", { method: "DELETE" }); serverRevoked = true; } catch { /* Logout also revokes the session in Redis. */ }
    try {
      if (activeMessaging) await (await import("firebase/messaging")).deleteToken(activeMessaging);
      const registration = await navigator.serviceWorker?.getRegistration("/firebase-push/");
      if (registration) { const subscription = await registration.pushManager.getSubscription(); if (subscription) await subscription.unsubscribe(); }
      browserRevoked = true;
    } catch { /* Server-side revocation remains authoritative. */ }
    if (!forLogout && !serverRevoked && !browserRevoked) throw new Error("Chưa tắt được push. Vui lòng thử lại khi có kết nối.");
  });
}
