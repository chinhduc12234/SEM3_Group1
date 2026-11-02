"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
export default function RegisterPage() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirm")) { setError("Mật khẩu xác nhận chưa khớp."); return; }
    setBusy(true);
    try { await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email: form.get("email"), fullName: form.get("fullName"), password: form.get("password") }) }); setDone(true); }
    catch (ex) { setError((ex as Error).message); } finally { setBusy(false); }
  }
  return <section className="auth-card"><p className="eyebrow">Bắt đầu kết nối</p><h1>Tạo tài khoản</h1>
    {done ? <div className="notice success">Đăng ký thành công. <Link href="/login">Đăng nhập để tiếp tục →</Link></div> : <form onSubmit={submit}>
    <label>Họ và tên<input name="fullName" required minLength={2} maxLength={200} autoComplete="name" /></label>
    <label>Email<input name="email" type="email" required maxLength={256} autoComplete="email" /></label>
    <label>Mật khẩu<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>Tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small></label>
    <label>Nhập lại mật khẩu<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
    {error && <p className="notice error" role="alert">{error}</p>}<button disabled={busy}>{busy ? "Đang tạo tài khoản…" : "Đăng ký"}</button>
    <p className="muted">Tài khoản mới có quyền USER. Quyền Owner tổ chức chỉ được cấp sau khi hồ sơ được duyệt.</p></form>}
    <p>Đã có tài khoản? <Link href="/login">Đăng nhập</Link></p></section>;
}
