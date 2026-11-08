"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Protected, useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import { useNotifications } from "@/features/notifications/components/NotificationProvider";
import type { InboxItem, InboxPage } from "@/features/notifications/types";

export default function Page() { return <Protected><Inbox/></Protected>; }
function Inbox() {
  const { user } = useAuth(); const router = useRouter();
  const { revision, connected, pushState, busy, enablePush, disablePush, refresh } = useNotifications();
  const [page, setPage] = useState(1); const [unread, setUnread] = useState(false);
  const [result, setResult] = useState<InboxPage | null>(null); const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  useEffect(() => {
    let active = true;
    api<InboxPage>(`/api/notifications?page=${page}&unread=${unread}`).then(data => { if (active) { setResult(data); setError(""); } }).catch(ex => { if (active) setError(ex.message); });
    return () => { active = false; };
  }, [page, unread, revision, user?.id]);
  async function open(item: InboxItem) {
    setWorking(true); setError("");
    try { await api(`/api/notifications/${item.id}/read`, { method: "PUT" }); await refresh();
      if (/^\/(?:admin\/)?organizations\/[0-9a-f-]+(?:\/manage)?$/.test(item.url)) router.push(item.url);
    } catch (ex) { setError((ex as Error).message); } finally { setWorking(false); }
  }
  async function readAll() {
    if (!result) return;
    setWorking(true);
    try { await api("/api/notifications/read-all", { method: "PUT", body: JSON.stringify({ through: result.asOf }) }); await refresh(); }
    catch (ex) { setError((ex as Error).message); } finally { setWorking(false); }
  }
  return <section className="nt-inbox"><div className="page-title"><div><p className="eyebrow">Give-AID · Cập nhật của bạn</p><h1>Thông báo</h1><p className="muted">{result?.unreadCount ?? 0} chưa đọc · {connected ? "Đã kết nối realtime" : "Đang kết nối realtime; danh sách vẫn tự cập nhật"}</p></div>
    <button className="secondary" onClick={readAll} disabled={working || !result?.unreadCount}>Đánh dấu tất cả đã đọc</button></div>
    <div className="nt-push"><div><strong>Thông báo trên trình duyệt</strong><p className="muted">Nhận cập nhật hồ sơ khi đang ở tab khác. Bạn có thể bật hoặc tắt bất cứ lúc nào.</p></div><div className="nt-actions"><button disabled={busy} onClick={enablePush}>Bật thông báo</button><button className="secondary" disabled={busy} onClick={disablePush}>Tắt push</button></div>{pushState && <p role="status">{pushState}</p>}</div>
    <div className="nt-actions"><button className={!unread ? "" : "secondary"} onClick={() => { setUnread(false); setPage(1); }}>Tất cả</button><button className={unread ? "" : "secondary"} onClick={() => { setUnread(true); setPage(1); }}>Chưa đọc</button><button className="quiet" onClick={() => void refresh()}>Tải lại</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!result && !error && <p>Đang tải thông báo…</p>}
    {result && <><ul className="nt-list">{result.items.map(item => <li key={item.id} className={item.readAt ? "" : "is-unread"}><button onClick={() => open(item)} disabled={working}><span className="nt-dot" aria-label={item.readAt ? "Đã đọc" : "Chưa đọc"}/><span><strong>{item.title}</strong><span className="nt-message">{item.message}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("vi-VN")}</time></span><span aria-hidden="true">→</span></button></li>)}</ul>
      {!result.items.length && <p className="notice">{unread ? "Bạn đã đọc hết thông báo." : "Chưa có thông báo. Các cập nhật hồ sơ mới sẽ xuất hiện ở đây."}</p>}
      <div className="nt-actions"><button className="secondary" disabled={page <= 1} onClick={() => setPage(x => x - 1)}>Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(result.totalCount / 20))}</span><button className="secondary" disabled={page * 20 >= result.totalCount} onClick={() => setPage(x => x + 1)}>Sau</button></div></>}
  </section>;
}
