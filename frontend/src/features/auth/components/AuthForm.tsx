"use client";
import authStyles from "@/features/auth/components/AuthForm.module.css";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import { useLocale } from "@/shared/i18n/LocaleProvider";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const { t } = useLocale();
  const { login, user, loading, sessionUnavailable, retrySession } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const loginFormHeight = useRef<number>(undefined);
  const submitting = useRef(false);
  const signedIn = !register && user !== null;
  const checkingSession = !register && (loading || sessionUnavailable || signedIn);

  useEffect(() => {
    if (register || loading || sessionUnavailable || !user) return;
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    if (returnTo && (
      /^\/chien-dich\/[a-f0-9-]{36}\?tham-gia=(ung-ho(&donation=[a-f0-9-]{36})?|hien-vat)$/i.test(returnTo) ||
      /^\/account\/(history(\?registration=[a-f0-9-]{36})?|payments(\?(payment|pledge)=[a-f0-9-]{36})?)$/i.test(returnTo) ||
      /^\/organizations\/[a-f0-9-]{36}\/manage\/(campaigns\/[a-f0-9-]{36}\/readiness|field-work|work)$/i.test(returnTo)
    )) {
      router.replace(returnTo);
      return;
    }
    if (user.roles.includes("ADMIN")) {
      router.replace("/admin");
      return;
    }

    let active = true;
    async function openWorkspace() {
      let destination = "/";
      try {
        const memberships = await api<{ id: string; roles?: string[] }[]>("/api/organizations/workspaces/mine");
        if (memberships.length === 1) {
          const membership = memberships[0];
          const memberOnly = membership.roles?.some((role) => ["STAFF", "SURVEY_STAFF"].includes(role)) &&
            !membership.roles?.some((role) => ["OWNER", "ORGANIZATION_MANAGER", "CAMPAIGN_MANAGER", "VOLUNTEER_COORDINATOR", "FINANCE_MANAGER"].includes(role));
          destination = `/organizations/${membership.id}/manage${memberOnly ? "/field-work" : ""}`;
        } else if (
          memberships.length > 1 ||
          (await api<unknown[]>("/api/organizations/invitations/mine")).length > 0
        ) {
          destination = "/organizations/mine";
        }
      } catch {
        /* Login remains usable when organization data is temporarily unavailable. */
      }
      if (active) router.replace(destination);
    }
    void openWorkspace();
    return () => { active = false; };
  }, [register, loading, sessionUnavailable, router, user]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current || checkingSession) return;
    setMessage("");
    const form = new FormData(e.currentTarget);
    if (!register) loginFormHeight.current = e.currentTarget.offsetHeight;
    if (register && form.get("password") !== form.get("confirm")) {
      setMessage(t("Mật khẩu xác nhận chưa khớp."));
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (register) {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            fullName: form.get("fullName"),
            email: form.get("email"),
            password: form.get("password"),
          }),
        });
        setDone(true);
      } else {
        await login(String(form.get("email")), String(form.get("password")));
      }
    } catch (ex) {
      setMessage((ex as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <main className={authStyles.auth}>
      <div className={authStyles.authPhoto}>
        <div>
          <p className="ga-overline">
            <span /> {t("CÙNG NHAU SẺ CHIA")}
          </p>
          <h1>
            {t("Điều tốt đẹp")}
            <br />
            <em>{t("khởi đầu từ bạn.")}</em>
          </h1>
          <p>{t("Một cộng đồng dành cho những người tin vào sức mạnh của sự tử tế.")}</p>
        </div>
        <small>GIVE-AID · {t("CÙNG NHAU TẠO NÊN THAY ĐỔI")}</small>
      </div>
      <div className={authStyles.authMain}>
        <Link className={authStyles.back} href="/">
          {t("← Về trang chủ")}
        </Link>
        <div className={authStyles.authBox}>
          <p className="ga-kicker">{t(register ? "THAM GIA CỘNG ĐỒNG" : "CHÀO MỪNG TRỞ LẠI")}</p>
          <h2>{t(register ? "Tạo tài khoản" : "Đăng nhập")}</h2>
          <p>
            {t(
              register
                ? "Bắt đầu hành trình sẻ chia cùng Give-AID."
                : "Tiếp tục hành trình sẻ chia của bạn.",
            )}
          </p>
          {done ? (
            <div className="notice success" role="status">
              {t("Đăng ký thành công.")}{" "}
              <Link className="ga-text-link" href="/login">
                {t("Đăng nhập để tiếp tục →")}
              </Link>
            </div>
          ) : (
            <div className={authStyles.authFormArea} style={signedIn ? { minHeight: loginFormHeight.current } : undefined}>
              {checkingSession && (
                <div className={authStyles.sessionStatus}>
                  {sessionUnavailable ? (
                    <div className="notice error" role="alert">
                      {t("Không thể kiểm tra phiên đăng nhập.")}{" "}
                      <button type="button" className="quiet" onClick={retrySession}>{t("Thử lại")}</button>
                    </div>
                  ) : (
                    <p className="notice" role="status">
                      {t(signedIn && !loading ? "Đang xử lý…" : "Đang kiểm tra phiên đăng nhập…")}
                    </p>
                  )}
                </div>
              )}
              {!signedIn && <form id={register ? "register-form" : "login-form"} method="post" onSubmit={submit} aria-busy={busy} inert={checkingSession}>
                {register && (
                  <label>
                    {t("Họ và tên")}
                    <input
                      name="fullName"
                      id="register-name"
                      required
                      minLength={2}
                      maxLength={200}
                      autoComplete="name"
                      placeholder={t("Nhập họ và tên")}
                    />
                  </label>
                )}
                <label>
                  {t("Email")}
                  <input
                    type="email"
                    name="email"
                    id={register ? "register-email" : "login-email"}
                    required
                    maxLength={256}
                    autoComplete={register ? "email" : "username"}
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="next"
                    placeholder="ban@example.com"
                  />
                </label>
                <div className={authStyles.passwordField}>
                  <label htmlFor={register ? "register-password" : "login-password"}>{t("Mật khẩu")}</label>
                  <div className={authStyles.credentialInput}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      id={register ? "register-password" : "login-password"}
                      required
                      minLength={register ? 12 : undefined}
                      maxLength={128}
                      autoComplete={register ? "new-password" : "current-password"}
                      enterKeyHint={register ? "next" : "go"}
                      placeholder={t("Nhập mật khẩu")}
                      aria-describedby={register ? "password-help" : undefined}
                    />
                    <button
                      type="button"
                      aria-label={t("Hiện mật khẩu")}
                      aria-pressed={showPassword}
                      aria-controls={register ? "register-password" : "login-password"}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {t(showPassword ? "Ẩn" : "Hiện")}
                    </button>
                  </div>
                  {register && (
                    <small id="password-help">
                      {t("Tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.")}
                    </small>
                  )}
                </div>
                {register && (
                  <label>
                    {t("Xác nhận mật khẩu")}
                    <input
                      type="password"
                      name="confirm"
                      id="register-confirm-password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder={t("Nhập lại mật khẩu")}
                    />
                  </label>
                )}
                {message && (
                  <p className={authStyles.formMessage} role="alert">
                    {message}
                  </p>
                )}
                <button
                  className={`ga-button ${authStyles.authSubmit}`}
                  disabled={busy || checkingSession}
                  type="submit"
                >
                  {t(busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập")}
                  <span>↗</span>
                </button>
              </form>}
            </div>
          )}
          <p className={authStyles.authSwitch}>
            {t(register ? "Đã có tài khoản?" : "Bạn chưa có tài khoản?")}{" "}
            <Link href={register ? "/login" : "/register"}>
              {t(register ? "Đăng nhập" : "Đăng ký ngay")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
