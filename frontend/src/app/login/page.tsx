"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
export default function LoginPage() {
  const { login } = useAuth(); const router = useRouter();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { const user = await login(String(form.get("email")), String(form.get("password")));
      router.push(user.roles.includes("ADMIN") ? "/admin/organizations" : "/organizations");
    } catch (ex) { setError((ex as Error).message); } finally { setBusy(false); }
  }
  return <section className="auth-card"><p className="eyebrow">Chào mừng trở lại</p><h1>Đăng nhập</h1><p className="muted">Tiếp tục hành trình cùng Give-AID.</p>
    <form onSubmit={submit}><label>Email<input name="email" type="email" required maxLength={256} autoComplete="username" /></label>
    <label>Mật khẩu<input name="password" type="password" required maxLength={128} autoComplete="current-password" /></label>
    {error && <p className="notice error" role="alert">{error}</p>}<button disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button></form>
    <p>Chưa có tài khoản? <Link href="/register">Đăng ký</Link></p></section>;
}
