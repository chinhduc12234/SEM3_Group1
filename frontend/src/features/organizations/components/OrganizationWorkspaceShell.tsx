"use client";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Protected, useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import { Workspace, labelsForRoles } from "@/features/organizations/types/workspace";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import { LanguageSwitch, LocalizedTree, useLocale } from "@/shared/i18n/LocaleProvider";
import "@/app/workspace.css";

const Context = createContext<{ data: Workspace; reload: () => Promise<void> }>(null!);
export const useWorkspace = () => useContext(Context);
export default function OrganizationWorkspaceShell({ children }: { children: ReactNode }) {
  return <Protected><Shell>{children}</Shell></Protected>;
}
function Shell({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const { id } = useParams<{ id: string }>(); const path = usePathname(); const router = useRouter(); const { user, logout } = useAuth();
  const [data, setData] = useState<Workspace | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const root = `/organizations/${id}/manage`;
  const reload = useCallback(async () => { const result = await api<Workspace>(`/api/organizations/${id}/workspace`); setData(result); setError(""); }, [id]);
  useEffect(() => { setData(null); reload().catch(ex => setError(ex.message)); }, [reload]);
  const links = [[root,t("Tổng quan")], [root+"/profile",t("Thông tin tổ chức")], [root+"/members",t("Nhân sự & vai trò")],
    ...(data?.roles.some(r => ["OWNER","CAMPAIGN_MANAGER"].includes(r)) ? [[root+"/campaigns",t("Chiến dịch")]] : []),
    ...(data?.canManageMembers ? [[root+"/legal",t("Hồ sơ pháp lý")], [root+"/activity",t("Nhật ký hoạt động")]] : [])];

  return <div className="ow-shell ga-dashboard">
    <aside className="ow-sidebar"><Link className="ga-logo" href="/organizations/mine" aria-label="Give-AID, không gian tổ chức"><img className="ga-logo-image" src="/giveaid-logo-transparent.png" alt="Give-AID"/></Link><p className="eyebrow">{t("KHÔNG GIAN TỔ CHỨC")}</p><h2>{data?.profile.displayName || t("Tổ chức của bạn")}</h2>
      <p className="ow-role">{data ? t(labelsForRoles(data.roles) || "Giám sát hệ thống") : t("Đang kiểm tra quyền…")}</p>
      <nav>{links.map(([href,label]) => <Link key={href} href={href} aria-current={path===href?"page":undefined}>{label}</Link>)}</nav>
      <div className="ow-sidebar-footer"><Link href="/organizations/mine">{t("← Đổi tổ chức / lời mời")}</Link><Link href="/account">{user?.fullName}</Link><Link href="/">{t("Về trang cộng đồng")}</Link><LanguageSwitch/>
        <button className="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await logout(); router.replace("/login"); } catch(ex) { setError((ex as Error).message); } finally { setBusy(false); } }}>{t("Đăng xuất")}</button></div>
    </aside>
    <div className="ow-main"><header className="ow-topbar"><span>Give-AID / {t("Quản lý tổ chức")}</span><div className="nt-actions"><NotificationBell/><Link href="/account">{user?.fullName}</Link></div></header><main className="ow-content">
      {error && <div className="notice error" role="alert">{error} <button className="quiet" onClick={() => { reload().catch(ex => setError(ex.message)); }}>{t("Tải lại")}</button></div>}
      {data ? <Context.Provider value={{data,reload}}><LocalizedTree>{children}</LocalizedTree></Context.Provider> : !error && <p>{t("Đang tải không gian tổ chức…")}</p>}
    </main></div>
  </div>;
}
