"use client";
import chromeStyles from "@/shared/site/SiteChrome.module.css";
import notificationsStyles from "@/features/notifications/Notifications.module.css";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import AccountAvatar from "@/shared/ui/AccountAvatar";
import { LanguageSwitch } from "@/shared/i18n/LanguageSwitch";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import SiteLogo from "./SiteLogo";
export function Header() {
  const { t } = useLocale();
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const scrollIfCurrent = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.pathname.replace(/\/$/, "") === href.replace(/\/$/, "")) {
      event.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  };
  const goHome = scrollIfCurrent("/");
  const links = (
    <>
      <Link href="/" onClick={goHome} aria-current={pathname === "/" ? "page" : undefined}>
        {t("Trang chủ")}
      </Link>
      <Link href="/chien-dich" onClick={scrollIfCurrent("/chien-dich")} aria-current={pathname.startsWith("/chien-dich") ? "page" : undefined}>
        {t("Chiến dịch")}
      </Link>
      {!loading && !user && (
        <Link href="/cach-tham-gia" onClick={scrollIfCurrent("/cach-tham-gia")} aria-current={pathname === "/cach-tham-gia" ? "page" : undefined}>
          {t("Cách tham gia")}
        </Link>
      )}
      <Link href="/organizations" onClick={scrollIfCurrent("/organizations")} aria-current={pathname.startsWith("/organizations") ? "page" : undefined}>
        {t("Tổ chức")}
      </Link>
      <Link href="/ve-chung-toi" aria-current={pathname === "/ve-chung-toi" ? "page" : undefined}>{t("Về chúng tôi")}</Link>
      <Link href="/ho-tro-khach-hang" aria-current={pathname === "/ho-tro-khach-hang" ? "page" : undefined}>{t("Hỗ trợ")}</Link>
      {user?.roles.includes("ADMIN") && <Link href="/admin">Dashboard</Link>}
    </>
  );
  const account = (
    <>
      {user ? (
        <>
          <NotificationBell />
          <Link className={`${chromeStyles.loginLink} ${chromeStyles.accountName}`} href="/account">
            <AccountAvatar userId={user.id} name={user.fullName} />
            <span className={chromeStyles.accountNameText}>{user.fullName}</span>
          </Link>
          <button
            className="ga-button ga-button-small"
            onClick={async () => {
              try {
                await logout();
                router.push("/");
                setOpen(false);
              } catch {
                setError(t("Chưa đăng xuất được. Vui lòng thử lại."));
              }
            }}
          >
            {t("Đăng xuất")}
          </button>
        </>
      ) : (
        !loading && (
          <>
            <Link className={chromeStyles.loginLink} href="/login">
              {t("Đăng nhập")}
            </Link>
            <Link className="ga-button ga-button-small" href="/register">
              {t("Chung tay ↗")}
            </Link>
          </>
        )
      )}
    </>
  );
  return (
    <>
      <header className={chromeStyles.header}>
        <div className={`ga-container ${chromeStyles.headerInner}`}>
          <SiteLogo href="/" label={t("Give-AID, trang chủ")} onClick={goHome} />
          <nav className={chromeStyles.nav} aria-label={t("Điều hướng chính")}>
            {links}
          </nav>
          <div className={notificationsStyles.mobileBell}>
            <NotificationBell />
          </div>
          <div className={chromeStyles.headerActions}>
            <LanguageSwitch />
            {account}
          </div>
          <details
            className={chromeStyles.mobileMenu}
            open={open}
            onToggle={(e) => setOpen(e.currentTarget.open)}
          >
            <summary aria-label={t("Mở menu")}>☰</summary>
            <nav
              aria-label={t("Điều hướng di động")}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setOpen(false);
              }}
            >
              <LanguageSwitch />
              {links}
              {account}
            </nav>
          </details>
        </div>
      </header>
      {error && (
        <div className="ga-container notice error" role="alert">
          {error}
          <button className="quiet" onClick={() => setError("")}>
            {t("Đóng")}
          </button>
        </div>
      )}
    </>
  );
}
export function Footer() {
  const { t } = useLocale();
  const goHome = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.pathname === "/") {
      event.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  };
  return (
    <footer className={chromeStyles.footer}>
      <div className="ga-container">
        <div className={chromeStyles.footerTop}>
          <div>
            <SiteLogo
              className={chromeStyles.footerLogo}
              href="/"
              onClick={goHome}
              label={t("Give-AID, trang chủ")}
            />
            <p>
              {t("Một nơi để những tấm lòng gặp nhau")}
              <br />
              {t("và cùng tạo nên thay đổi.")}
            </p>
          </div>
          <div>
            <strong>{t("Khám phá")}</strong>
            <Link href="/chien-dich">{t("Chiến dịch")}</Link>
            <Link href="/cach-tham-gia">{t("Cách tham gia")}</Link>
            <Link href="/organizations">{t("Tổ chức")}</Link>
            <Link href="/ve-chung-toi">{t("Về chúng tôi")}</Link>
          </div>
          <div>
            <strong>{t("Tham gia")}</strong>
            <Link href="/dang-ky">{t("Tạo tài khoản")}</Link>
            <Link href="/dang-nhap">{t("Đăng nhập")}</Link>
            <Link href="/ho-tro-khach-hang">{t("Hỗ trợ khách hàng")}</Link>
          </div>
          <div className={chromeStyles.footerNote}>
            <strong>{t("Mỗi hành động đều có ý nghĩa.")}</strong>
            <p>{t("Cùng nhau lan tỏa sự quan tâm đến những nơi cần được sẻ chia.")}</p>
          </div>
        </div>
        <div className={chromeStyles.footerBottom}>
          <span>© {new Date().getFullYear()} Give-AID</span>
          <span>{t("Cùng nhau sẻ chia ♡")}</span>
        </div>
      </div>
    </footer>
  );
}
