"use client";
import workspaceStyles from "@/features/organizations/workspace/Workspace.module.css";
import notificationsStyles from "@/features/notifications/Notifications.module.css";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SiteLogo from "@/shared/site/SiteLogo";
import { useParams, usePathname, useRouter } from "next/navigation";
import Protected from "@/features/auth/components/Protected";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import { Workspace, labelsForRoles } from "@/features/organizations/types/workspace";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import { LanguageSwitch } from "@/shared/i18n/LanguageSwitch";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { WorkspaceContext } from "../WorkspaceContext";

export default function OrganizationWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <Protected>
      <Shell>{children}</Shell>
    </Protected>
  );
}
function Shell({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const root = `/organizations/${id}/manage`;
  const reload = useCallback(async () => {
    const result = await api<Workspace>(`/api/organizations/${id}/workspace`);
    setData(result);
    setError("");
  }, [id]);
  useEffect(() => {
    setData(null);
    reload().catch((ex) => setError(ex.message));
  }, [reload]);
  const links = [
    [root + "/members", t("Nhân sự")],
    ...(data?.roles.includes("CAMPAIGN_MANAGER")
      ? [[root + "/campaigns", t("Chiến dịch và sự kiện")]]
      : data?.roles.includes("OWNER") ? [[root + "/campaigns", t("Duyệt và phân công")]] : []),
    ...(data?.roles.includes("VOLUNTEER_COORDINATOR")
      ? [[root + "/operations", t("Vận hành")]]
      : []),
    ...(data?.roles.includes("FINANCE_MANAGER") ? [[root + "/budget", t("Ngân sách")]] : []),
  ];

  return (
    <div className={`${workspaceStyles.shell} ga-dashboard`} data-ow-shell="">
      <aside className={workspaceStyles.sidebar}>
        <SiteLogo href="/organizations/mine" label={t("Give-AID, không gian tổ chức")} />
        <p className="eyebrow">{t("KHÔNG GIAN TỔ CHỨC")}</p>
        <h2>{data?.profile.displayName || t("Tổ chức của bạn")}</h2>
        <p className={workspaceStyles.role}>
          {data ? t(labelsForRoles(data.roles) || "Giám sát hệ thống") : t("Đang kiểm tra quyền…")}
        </p>
        <nav>
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href || path.startsWith(href + "/") || (path === root && href === root + "/members") ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className={workspaceStyles.sidebarFooter}>
          <LanguageSwitch />
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await logout();
                router.replace("/login");
              } catch (ex) {
                setError((ex as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Đăng xuất")}
          </button>
        </div>
      </aside>
      <div className={workspaceStyles.main}>
        <header className={workspaceStyles.topbar}>
          <span>Give-AID / {t("Quản lý tổ chức")}</span>
          <div className={notificationsStyles.actions}>
            <NotificationBell href={`${root}/notifications`} />
            {data?.roles.includes("OWNER") ? (
              <Link href={`${root}/account`}>{user?.fullName}</Link>
            ) : (
              <span>{user?.fullName}</span>
            )}
          </div>
        </header>
        <main className={workspaceStyles.content} data-ow-content="">
          {error && (
            <div className="notice error" role="alert">
              {error}{" "}
              <button
                className="quiet"
                onClick={() => {
                  reload().catch((ex) => setError(ex.message));
                }}
              >
                {t("Tải lại")}
              </button>
            </div>
          )}
          {data ? (
            <WorkspaceContext.Provider value={{ data, reload }}>
              <LocalizedTree>{children}</LocalizedTree>
            </WorkspaceContext.Provider>
          ) : (
            !error && <p>{t("Đang tải không gian tổ chức…")}</p>
          )}
        </main>
      </div>
    </div>
  );
}
