"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/shared/api/api";

type Notification = {
  id: string; action: string; state: "PENDING" | "SENT" | "FAILED";
  attempts: number; createdAt: string; nextAttemptAt: string; sentAt: string | null; lastErrorCode: string | null;
};
type Result = { totalCount: number; items: Notification[] };
const actions: Record<string, string> = { SUBMITTED: "Tiếp nhận hồ sơ", APPROVE: "Phê duyệt", REQUEST_CHANGES: "Yêu cầu bổ sung", REJECT: "Từ chối" };
const states = { PENDING: "Đang chờ gửi / thử lại", SENT: "EmailJS đã tiếp nhận", FAILED: "Gửi thất bại" };

export function OrganizationEmailStatus({ organizationId }: { organizationId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await api<Result>(`/api/organizations/notifications?organizationId=${encodeURIComponent(organizationId)}&page=${page}`);
      setResult(response); setError("");
    } catch (ex) { setError((ex as Error).message); }
  }, [organizationId, page]);
  useEffect(() => { void load(); }, [load]);
  const pending = result?.items.some(item => item.state === "PENDING");
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [pending, load]);

  async function retry(id: string) {
    setBusy(true);
    try { await api(`/api/organizations/notifications/${id}/retry`, { method: "POST" }); await load(); }
    catch (ex) { setError((ex as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>Thông báo email</h2>
    <p className="muted">Email được gửi đến tài khoản nộp hồ sơ. Trạng thái tiếp nhận từ EmailJS chưa xác nhận thư đã vào hộp thư người nhận.</p>
    <button className="secondary" disabled={busy} onClick={() => { void load(); }}>Cập nhật trạng thái</button>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!result ? <p>Đang tải thông báo…</p> : result.totalCount === 0 ? <p>Chưa có thông báo email cho hồ sơ này.</p> : <>
      {result.items.map(item => <div className="upload-row" key={item.id}>
        <div>
          <strong>{actions[item.action] || item.action}</strong>
          <p>{states[item.state]} · Đã thử {item.attempts} lần</p>
          <small className="muted">Tạo lúc {new Date(item.createdAt).toLocaleString("vi-VN")}
            {item.sentAt && <> · Tiếp nhận lúc {new Date(item.sentAt).toLocaleString("vi-VN")}</>}
            {item.state === "PENDING" && item.attempts > 0 && <> · Thử lại từ {new Date(item.nextAttemptAt).toLocaleString("vi-VN")}</>}
          </small>
          {item.lastErrorCode && <p className="muted">Mã lỗi: {item.lastErrorCode}</p>}
        </div>
        {item.state === "FAILED" && <button className="secondary" disabled={busy} onClick={() => { void retry(item.id); }}>Thử gửi lại</button>}
      </div>)}
      {result.totalCount > 20 && <div className="actions">
        <button className="secondary" disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>Trang trước</button>
        <span>Trang {page} / {Math.ceil(result.totalCount / 20)}</span>
        <button className="secondary" disabled={page * 20 >= result.totalCount || busy} onClick={() => setPage(page + 1)}>Trang sau</button>
      </div>}
    </>}
  </section>;
}
