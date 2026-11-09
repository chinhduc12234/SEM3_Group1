"use client";

export type Account = { id: string; email: string; fullName: string; roles: string[] };
type Session = { accessToken: string; user: Account };
let accessToken: string | null = null;
let refreshing: Promise<Session | null> | null = null;

// Keep credentials out of browser storage. Web Locks serialize rotating cookies across tabs.
export async function refreshSession(): Promise<Session | null> {
  if (!refreshing) {
    const execute = async () => {
      const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin", headers: { "X-Requested-With": "GiveAid" } });
      if (!response.ok) { accessToken = null; return null; }
      const session: Session = await response.json(); accessToken = session.accessToken; return session;
    };
    const guarded = async (): Promise<Session | null> => {
      if ("locks" in navigator) return await navigator.locks.request("giveaid-refresh", execute);
      return await execute();
    };
    refreshing = guarded().finally(() => { refreshing = null; });
  }
  return refreshing;
}
export function acceptSession(session: Session) { accessToken = session.accessToken; }
export function forgetSession() { accessToken = null; }
export async function realtimeAccessToken(): Promise<string> {
  if (accessToken) {
    try { if (JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000 > Date.now() + 30000) return accessToken; } catch { /* Refresh malformed credentials. */ }
  }
  const session = await refreshSession();
  if (!session) { window.dispatchEvent(new Event("giveaid-session-expired")); throw new Error("Session expired"); }
  return session.accessToken;
}
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("X-Requested-With", "GiveAid");
  if (accessToken) headers.set("Authorization", "Bearer " + accessToken);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  if (response.status === 401 && retry && (!path.startsWith("/api/auth/") || path === "/api/auth/password" || path === "/api/auth/me")) {
    if (await refreshSession()) return api<T>(path, options, false);
    window.dispatchEvent(new Event("giveaid-session-expired"));
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    const detail = problem.errors ? Object.values(problem.errors).flat().join(" ") : problem.title;
    throw new ApiError(detail || "Không thể xử lý yêu cầu. Vui lòng thử lại.", response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export async function downloadDocument(path: string, name: string) {
  // Fetch with the bearer token, then download an attachment instead of exposing a public URL.
  const execute = () => fetch(path, { headers: { Authorization: "Bearer " + accessToken }, credentials: "same-origin" });
  let response = await execute();
  if (response.status === 401 && await refreshSession()) response = await execute();
  if (!response.ok) throw new Error("Không có quyền tải tệp hoặc phiên đã hết hạn.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function apiBlob(path: string): Promise<Blob> {
  const execute = () => fetch(path, { headers: { Authorization: "Bearer " + accessToken }, credentials: "same-origin", cache: "no-store" });
  let response = await execute();
  if (response.status === 401 && await refreshSession()) response = await execute();
  if (!response.ok) throw new ApiError("Không tải được ảnh tổ chức.", response.status);
  return response.blob();
}
