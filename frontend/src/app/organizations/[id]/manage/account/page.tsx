"use client";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { useWorkspace } from "@/features/organizations/components/OrganizationWorkspaceShell";
import { Account, api, forgetSession } from "@/shared/api/api";

export default function OwnerAccountPage() {
  const { data } = useWorkspace();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { setName(user?.fullName ?? ""); setEmail(user?.email ?? ""); }, [user]);

  if (!data.roles.includes("OWNER")) return <p className="notice error">Chỉ chủ tổ chức mới có thể quản lý hồ sơ tài khoản Owner.</p>;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const account = await api<Account>("/api/auth/profile", { method: "PUT", body: JSON.stringify({ fullName: name.trim(), email: email.trim() }) });
      updateUser(account); setMessage("Hồ sơ tài khoản đã được cập nhật.");
    } catch (ex) { setError((ex as Error).message); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmPassword") ?? "")) { setError("Mật khẩu xác nhận chưa khớp."); setBusy(false); return; }
    try {
      await api("/api/auth/password", { method: "POST", body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword }) });
      forgetSession(); window.location.assign("/login?passwordChanged=1");
    } catch (ex) { setError((ex as Error).message); setBusy(false); }
  }

  return <div className="owner-account-page">
    <p className="eyebrow">TÀI KHOẢN & BẢO MẬT</p>
    <h1>Hồ sơ tài khoản Owner</h1>
    <p className="muted">Quản lý thông tin đăng nhập và bảo mật cho tài khoản của bạn.</p>

    <section className="panel owner-account-identity">
      <div className="owner-account-avatar" aria-hidden="true">{(user?.fullName || "O").trim().charAt(0).toUpperCase()}</div>
      <div><p className="eyebrow">CHỦ TỔ CHỨC</p><h2>{user?.fullName}</h2><p className="muted">{data.profile.displayName}</p></div>
      <span className="owner-account-badge">OWNER</span>
    </section>

    <section className="panel">
      <h2>Thông tin tài khoản</h2>
      <p className="muted">Email được dùng để đăng nhập và nhận thông báo quan trọng.</p>
      <form onSubmit={saveProfile}>
        <div className="form-grid">
          <label>Họ và tên<input required minLength={2} maxLength={200} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Email đăng nhập<input required type="email" maxLength={256} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        </div>
        <button disabled={busy || !name.trim() || !email.trim()}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button>
      </form>
    </section>

    <section className="panel">
      <h2>Đổi mật khẩu</h2>
      <p className="muted">Mật khẩu không được hiển thị. Sau khi đổi, các phiên đăng nhập hiện tại sẽ bị thu hồi.</p>
      <form onSubmit={changePassword}>
        <div className="form-grid">
          <label className="full">Mật khẩu hiện tại<input required type="password" name="currentPassword" autoComplete="current-password" maxLength={128} /></label>
          <label>Mật khẩu mới<input required type="password" name="newPassword" autoComplete="new-password" minLength={12} maxLength={128} /><small>Ít nhất 12 ký tự.</small></label>
          <label>Nhập lại mật khẩu mới<input required type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} /></label>
        </div>
        <button className="secondary" disabled={busy}>Đổi mật khẩu</button>
      </form>
    </section>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
  </div>;
}
