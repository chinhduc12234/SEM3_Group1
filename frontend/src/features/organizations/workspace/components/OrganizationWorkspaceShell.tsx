"use client";
import workspaceStyles from "@/features/organizations/workspace/Workspace.module.css";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import Protected from "@/features/auth/components/Protected";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api, ApiError } from "@/shared/api/api";
import { Workspace, labelsForRoles } from "@/features/organizations/types/workspace";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import { LanguageSwitch } from "@/shared/i18n/LanguageSwitch";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { WorkspaceContext } from "../WorkspaceContext";
import { WorkspaceIcon, type WorkspaceIconName } from "./WorkspaceUI";

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
  const isVolunteerPage = path === `${root}/volunteers` || path.startsWith(`${root}/volunteers/`);
  const isMemberOnly = !!data && !data.roles.some((role) =>
    ["OWNER", "CAMPAIGN_MANAGER", "VOLUNTEER_COORDINATOR", "FINANCE_MANAGER"].includes(role),
  );
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api<Workspace>(`/api/organizations/${id}/workspace`, { signal });
      if (signal?.aborted) return;
      setData(result);
      setError("");
    } catch (failure) {
      if (signal?.aborted) return;
      if (failure instanceof ApiError && (failure.status === 403 || failure.status === 404)) {
        setData(null);
        setError("");
        router.replace("/");
        return;
      }
      throw failure;
    }
  }, [id, router]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    reload(controller.signal).catch((ex) => { if (!controller.signal.aborted) setError(ex.message); });
    return () => controller.abort();
  }, [reload, user?.id, isVolunteerPage]);
  const isOwner = data?.roles.includes("OWNER");
  const isCoordinator = data?.roles.includes("VOLUNTEER_COORDINATOR");
  const volunteerAccessDenied = !!data && isVolunteerPage && !isCoordinator;
  useEffect(() => {
    if (volunteerAccessDenied) router.replace("/");
  }, [router, volunteerAccessDenied]);

  function retryWorkspace() {
    setError("");
    reload().catch((ex) => setError(ex.message));
  }

  if (!data || volunteerAccessDenied) return (
    <main className={workspaceStyles.content}>
      {error ? <div className="notice error" role="alert">
        {error} <button type="button" className="quiet" onClick={retryWorkspace}>{t("Tải lại")}</button>
      </div> : <p role="status">{t("Đang tải không gian tổ chức…")}</p>}
    </main>
  );
  const navItems: [string, string, WorkspaceIconName, boolean | undefined][] = [
    ["", "Tổng quan", "building", isOwner],
    ["/work", "Việc của tôi", "work", !!data && !isMemberOnly],
    ["/field-work", "Việc được giao", "calendar", !!data?.roles.length],
    ["/members", data?.canManageMembers ? "Nhân sự" : "Danh bạ nội bộ", "people", true],
    ["/profile", "Hồ sơ tổ chức", "building", data?.canEdit],
    ["/legal", "Pháp lý", "file", isOwner],
    ["/activity", "Nhật ký", "clock", isOwner],
    ["/campaigns", data?.roles.includes("CAMPAIGN_MANAGER") ? "Chiến dịch và sự kiện" : "Duyệt và phân công", "folder",
      isOwner || data?.roles.includes("CAMPAIGN_MANAGER")],
    ["/operations", "Vận hành", "operations", isCoordinator],
    ["/volunteers", "Tình nguyện viên", "people", isCoordinator],
    ["/budget", "Ngân sách và quyên góp", "folder", data?.roles.includes("FINANCE_MANAGER")],
  ];
  const currentSection = navItems.find(([suffix, , , visible]) =>
    visible && (path === root + suffix || (suffix && path.startsWith(root + suffix + "/")) ||
      (path === root && !isOwner && suffix === "/members")));
  const initials = user?.fullName?.trim().split(/\s+/).slice(-2).map((part) => part.charAt(0)).join("").toUpperCase();

  return (
    <div className={`${workspaceStyles.shell} ga-dashboard`} data-ow-shell="">
      <aside className={workspaceStyles.sidebar}>
        <div className={`ga-logo ${workspaceStyles.brand}`}>
          <img className="ga-logo-image" src="/giveaid-logo-transparent.png" alt="Give-AID" />
        </div>
        <div className={workspaceStyles.organization}>
          <p className="eyebrow">{t("KHÔNG GIAN TỔ CHỨC")}</p>
          <h2>{data?.profile.displayName || t("Tổ chức của bạn")}</h2>
          <p className={workspaceStyles.role}>
            {data ? t(labelsForRoles(data.roles) || "Giám sát hệ thống") : t("Đang kiểm tra quyền…")}
          </p>
        </div>
        <nav aria-label={t("Quản lý tổ chức")}>
          {navItems.filter(([, , , visible]) => visible).map(([suffix, label, icon]) => (
            <Link key={suffix} href={root + suffix} aria-current={currentSection?.[0] === suffix ? "page" : undefined}>
              <WorkspaceIcon name={icon} />
              <span>{t(label)}</span>
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
            <WorkspaceIcon name="logout" />{t("Đăng xuất")}
          </button>
        </div>
      </aside>
      <div className={workspaceStyles.main}>
        <header className={workspaceStyles.topbar}>
          <div className={workspaceStyles.breadcrumb}>
            <span>{t("Quản lý tổ chức")}</span>
            {currentSection && <><span aria-hidden="true">/</span><strong>{t(currentSection[1])}</strong></>}
          </div>
          <div className={workspaceStyles.workspaceActions}>
            <NotificationBell href={`${root}/notifications`} />
            {user?.fullName && (isOwner
              ? <Link className={workspaceStyles.workspaceUser} href={`${root}/account`}>
                <span aria-hidden="true">{initials}</span><strong>{user.fullName}</strong>
              </Link>
              : <span className={workspaceStyles.workspaceUser} title={user.fullName}>
                <span aria-hidden="true">{initials}</span><strong>{user.fullName}</strong>
              </span>)}
          </div>
        </header>
        <main className={workspaceStyles.content} data-ow-content="">
          {error && (
            <div className="notice error" role="alert">
              {error}{" "}
              <button
                className="quiet"
                onClick={retryWorkspace}
              >
                {t("Tải lại")}
              </button>
            </div>
          )}
          <WorkspaceContext.Provider value={{ data, reload }}>
            <LocalizedTree>{children}</LocalizedTree>
          </WorkspaceContext.Provider>
        </main>
      </div>
    </div>
  );
}
