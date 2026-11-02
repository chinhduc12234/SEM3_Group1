"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Protected, useAuth } from "@/components/AuthProvider";
import { api, forgetSession } from "@/lib/api";
function Account() {
  const { user } = useAuth(); const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); const form = new FormData(e.currentTarget);
    if (form.get("newPassword") !== form.get("confirm")) { setError("Mật khẩu xác nhận chưa khớp."); return; }
    setBusy(true);
    try { await api("/api/auth/password", { method: "POST", body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) }); forgetSession(); window.location.assign("/login"); }
    catch (ex) { setError((ex as Error).message); } finally { setBusy(false); }
  }
  return <section className="auth-card"><p className="eyebrow">{user?.roles.join(" / ")}</p><h1>Tài khoản của bạn</h1><p>{user?.fullName}<br /><span className="muted">{user?.email}</span></p><div className="actions"><Link className="button secondary" href="/organizations/mine">Hồ sơ tổ chức ↗</Link></div><h2>Đổi mật khẩu</h2><form onSubmit={submit}>
    <label>Mật khẩu hiện tại<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" /></label>
    <label>Mật khẩu mới<input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>Ít nhất 12 ký tự gồm chữ hoa, thường, số và ký tự đặc biệt.</small></label>
    <label>Nhập lại mật khẩu mới<input name="confirm" type="password" required maxLength={128} autoComplete="new-password" /></label>
    <p className="muted">Sau khi đổi, mọi phiên đăng nhập sẽ được thu hồi.</p>{error && <p className="notice error">{error}</p>}<button disabled={busy}>{busy ? "Đang xử lý…" : "Đổi mật khẩu"}</button></form></section>;
}
export default function Page() { return <Protected><Account /></Protected>; }
