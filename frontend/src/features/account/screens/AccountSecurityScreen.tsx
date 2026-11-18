"use client";
import accountStyles from "@/features/account/Account.module.css";
import { FormEvent, useState } from "react";
import Protected from "@/features/auth/components/Protected";
import { api, forgetSession } from "@/shared/api/api";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";

function SecurityPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("newPassword") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: password,
        }),
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
      <div className={accountStyles.accountSubpage}>
        <header className={accountStyles.accountPageHeading}>
          <p className={accountStyles.userProfileKicker}>AN TOÀN TÀI KHOẢN</p>
          <h1>Bảo mật</h1>
          <p>Kiểm soát cách bảo vệ tài khoản và mật khẩu Give-AID của bạn.</p>
        </header>
        <section className={accountStyles.accountSubcard}>
          <span className={accountStyles.accountSubcardMark}>⌑</span>
          <div>
            <h2>Đổi mật khẩu</h2>
            <p>
              Mật khẩu được mã hóa và không hiển thị. Sau khi đổi, bạn sẽ đăng nhập lại bằng mật
              khẩu mới.
            </p>
          </div>
          <form method="post" className={accountStyles.accountSecurityForm} onSubmit={changePassword}>
            <label>
              Mật khẩu hiện tại
              <input
                required
                type="password"
                name="currentPassword"
                id="account-current-password"
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <label>
              Mật khẩu mới
              <input
                required
                type="password"
                name="newPassword"
                id="account-new-password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
              <small>Ít nhất 12 ký tự.</small>
            </label>
            <label>
              Nhập lại mật khẩu mới
              <input
                required
                type="password"
                name="confirmPassword"
                id="account-confirm-password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <button disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật mật khẩu"}</button>
          </form>
        </section>
        <section className={accountStyles.accountSafetyTip}>
          <strong>Gợi ý bảo vệ tài khoản</strong>
          <p>
            Dùng mật khẩu riêng, khó đoán; không chia sẻ mã xác minh hoặc thông tin đăng nhập với
            người khác.
          </p>
        </section>
        {error && <p className={`${accountStyles.userProfileAlert} error`}>{error}</p>}
        {message && <p className={`${accountStyles.userProfileAlert} success`}>{message}</p>}
      </div>
    </LocalizedTree>
  );
}
export default function AccountSecurityScreen() {
  return (
    <Protected>
      <SecurityPage />
    </Protected>
  );
}
