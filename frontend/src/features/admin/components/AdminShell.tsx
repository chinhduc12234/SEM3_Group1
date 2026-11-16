"use client";
import adminStyles from "@/features/admin/Admin.module.css";
import { ReactNode, useState } from "react";
import Link from "next/link";
import SiteLogo from "@/shared/site/SiteLogo";
import { usePathname, useRouter } from "next/navigation";
import Protected from "@/features/auth/components/Protected";
import { useAuth } from "@/features/auth/components/AuthProvider";
import Icon from "@/features/admin/components/AdminIcon";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import { LanguageSwitch } from "@/shared/i18n/LanguageSwitch";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <Protected admin>
      <Shell>{children}</Shell>
    </Protected>
  );
}
function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const name = user?.fullName || "Quản trị viên";
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <LocalizedTree>
      <div className={adminStyles.shell}>
        <aside className={adminStyles.sidebar}>
          <div className={adminStyles.brandRow}>
            <SiteLogo href="/admin" label="Give-AID, trang quản trị" />
            <button
              className={adminStyles.menu}
              aria-label={open ? "Đóng điều hướng" : "Mở điều hướng"}
              aria-expanded={open}
              aria-controls="admin-navigation"
              onClick={() => setOpen(!open)}
            >
              <Icon name={open ? "close" : "menu"} />
            </button>
          </div>
          <div
            className={adminStyles.sidebarMenu + (open ? ` ${adminStyles.isOpen}` : "")}
            id="admin-navigation"
          >
            <p className={adminStyles.sidebarLabel}>KHÔNG GIAN LÀM VIỆC</p>
            <nav aria-label="Dashboard Admin" onClick={() => setOpen(false)}>
              <Link href="/admin" aria-current={path === "/admin" ? "page" : undefined}>
                <Icon name="grid" />
                Tổng quan<small>01</small>
              </Link>
              <Link
                href="/admin/organizations"
                aria-current={path.startsWith("/admin/organizations") ? "page" : undefined}
              >
                <Icon name="folder" />
                Quản trị tổ chức<small>02</small>
              </Link>
              <Link
                href="/admin/organization-directory"
                aria-current={path.startsWith("/admin/organization-directory") ? "page" : undefined}
              >
                <Icon name="globe" />
                Danh bạ tổ chức<small>03</small>
              </Link>
            </nav>
            <div className={adminStyles.sidebarNote}>
              <Icon name="shield" size={26} />
              <strong>Niềm tin từ sự minh bạch</strong>
              <p>Mỗi hồ sơ được xem xét cẩn thận là một kết nối tốt đẹp hơn.</p>
            </div>
            <div className={adminStyles.sidebarBottom}>
              <Link href="/">
                <Icon name="globe" size={18} />
                Xem trang cộng đồng
              </Link>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await logout();
                    router.replace("/login");
                  } catch {
                    setError("Chưa đăng xuất được. Vui lòng thử lại.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Icon name="logout" size={18} />
                {busy ? "Đang đăng xuất…" : "Đăng xuất"}
              </button>
            </div>
            <div className={adminStyles.sidebarUser}>
              <span className={adminStyles.avatar}>{initial}</span>
              <div>
                <strong>{name}</strong>
                <small>Quản trị viên hệ thống</small>
              </div>
            </div>
          </div>
        </aside>
        <div className={adminStyles.workspace}>
          <header className={adminStyles.topbar}>
            <div className={adminStyles.breadcrumb}>
              <span>Không gian quản trị</span>
              <b>/</b>
              <strong>
                {path === "/admin"
                  ? "Tổng quan"
                  : path.startsWith("/admin/owner-profiles")
                    ? "Hồ sơ Owner"
                    : path.startsWith("/admin/organization-directory")
                      ? "Danh bạ tổ chức"
                    : path === "/admin/notifications"
                      ? "Thông báo"
                      : path === "/admin/organizations"
                        ? "Tổ chức"
                        : "Chi tiết hồ sơ"}
              </strong>
            </div>
            <div className={adminStyles.topbarAccount}>
              <LanguageSwitch />
              <NotificationBell href="/admin/notifications" />
              <span className={adminStyles.role}>
                <Icon name="shield" size={13} />
                ADMIN
              </span>
              <Link
                className={adminStyles.avatar}
                href="/admin/owner-profiles"
                aria-label="Quản lý hồ sơ Owner"
              >
                {initial}
              </Link>
            </div>
          </header>
          <main className={`${adminStyles.content} ga-dashboard`}>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            {children}
          </main>
          <div className={adminStyles.footnote}>
            <span>Give-AID · Cùng sẻ chia, cùng thay đổi</span>
            <span>Không gian quản trị</span>
          </div>
        </div>
      </div>
    </LocalizedTree>
  );
}
