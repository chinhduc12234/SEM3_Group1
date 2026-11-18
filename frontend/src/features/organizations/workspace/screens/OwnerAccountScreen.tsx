"use client";
import workspaceStyles from "@/features/organizations/workspace/Workspace.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import { Account, api, forgetSession } from "@/shared/api/api";

export default function OwnerAccountScreen() {
  const { data } = useWorkspace();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setName(user?.fullName ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  if (!data.roles.includes("OWNER"))
    return (
      <LocalizedTree>
        <p className="notice error">Chỉ chủ tổ chức mới có thể quản lý hồ sơ tài khoản Owner.</p>
      </LocalizedTree>
    );

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const account = await api<Account>("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ fullName: name.trim(), email: email.trim() }),
      });
      updateUser(account);
      setMessage("Hồ sơ tài khoản đã được cập nhật.");
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmPassword") ?? "")) {
      setError("Mật khẩu xác nhận chưa khớp.");
      setBusy(false);
      return;
    }
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword }),
      });
      forgetSession();
      window.location.assign("/login?passwordChanged=1");
    } catch (ex) {
      setError((ex as Error).message);
      setBusy(false);
    }
  }

  return (
    <LocalizedTree>
      <div className={workspaceStyles.ownerAccountPage}>
        <header className={workspaceStyles.ownerAccountHero}>
          <div>
            <p className="eyebrow">TÀI KHOẢN & BẢO MẬT</p>
            <h1>Hồ sơ tài khoản Owner</h1>
            <p>Quản lý thông tin đăng nhập và bảo mật cho tài khoản của bạn.</p>
          </div>
          <div className={workspaceStyles.ownerAccountHeroMark} aria-hidden="true">
            <span />
          </div>
        </header>

        <section className={`panel ${workspaceStyles.ownerAccountIdentity}`}>
          <div className={workspaceStyles.ownerAccountAvatar} aria-hidden="true">
            {(user?.fullName || "O").trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="eyebrow">CHỦ TỔ CHỨC</p>
            <h2>{user?.fullName}</h2>
            <p className="muted">{data.profile.displayName}</p>
          </div>
          <span className={workspaceStyles.ownerAccountBadge}>OWNER</span>
        </section>

        <div className={workspaceStyles.ownerAccountGrid}>
          <section className={`panel ${workspaceStyles.ownerAccountPanel}`}>
            <div className={workspaceStyles.ownerAccountSectionHeading}>
              <span>01</span>
              <div>
                <h2>Thông tin tài khoản</h2>
                <p>Email được dùng để đăng nhập và nhận thông báo quan trọng.</p>
              </div>
            </div>
            <form onSubmit={saveProfile}>
              <div className="form-grid">
                <label>
                  Họ và tên
                  <input
                    required
                    minLength={2}
                    maxLength={200}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Email đăng nhập
                  <input
                    required
                    type="email"
                    maxLength={256}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>
              <button disabled={busy || !name.trim() || !email.trim()}>
                {busy ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </form>
          </section>

          <section className={`panel ${workspaceStyles.ownerAccountPanel} ${workspaceStyles.ownerSecurityPanel}`}>
            <div className={workspaceStyles.ownerAccountSectionHeading}>
              <span>02</span>
              <div>
                <h2>Đổi mật khẩu</h2>
                <p>Mật khẩu không được hiển thị. Các phiên đăng nhập sẽ kết thúc sau khi đổi.</p>
              </div>
            </div>
            <form method="post" onSubmit={changePassword}>
              <div className="form-grid">
                <label className="full">
                  Mật khẩu hiện tại
                  <input
                    required
                    type="password"
                    name="currentPassword"
                    id="owner-current-password"
                    autoComplete="current-password"
                    maxLength={128}
                  />
                </label>
                <label>
                  Mật khẩu mới
                  <input
                    required
                    type="password"
                    name="newPassword"
                    id="owner-new-password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                  />
                  <small>Ít nhất 12 ký tự.</small>
                </label>
                <label>
                  Nhập lại mật khẩu mới
                  <input
                    required
                    type="password"
                    name="confirmPassword"
                    id="owner-confirm-password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                  />
                </label>
              </div>
              <button className="secondary" disabled={busy}>
                {busy ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
              </button>
            </form>
          </section>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice success" role="status">{message}</p>}
      </div>
    </LocalizedTree>
  );
}
