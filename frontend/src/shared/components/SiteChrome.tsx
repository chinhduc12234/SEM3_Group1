"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import { LanguageSwitch, useLocale } from "@/shared/i18n/LocaleProvider";
export function Header() {
 const { t } = useLocale();
 const { user, loading, logout } = useAuth(); const router = useRouter(); const [error,setError]=useState("");
 const [open,setOpen]=useState(false);
 const scrollIfCurrent=(href:string)=>(event:React.MouseEvent<HTMLAnchorElement>)=>{if(window.location.pathname.replace(/\/$/,"")===href.replace(/\/$/,"")){event.preventDefault();window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});}};
 const goHome=scrollIfCurrent("/");
 const links=<><Link href="/" onClick={goHome}>{t("Trang chủ")}</Link><Link href="/chien-dich" onClick={scrollIfCurrent("/chien-dich")}>{t("Chiến dịch")}</Link><Link href="/cach-tham-gia" onClick={scrollIfCurrent("/cach-tham-gia")}>{t("Cách tham gia")}</Link><Link href="/organizations" onClick={scrollIfCurrent("/organizations")}>{t("Tổ chức")}</Link>{user && <Link href="/organizations/mine" onClick={scrollIfCurrent("/organizations/mine")}>{t("Tổ chức của tôi")}</Link>}{user?.roles.includes("ADMIN") && <Link href="/admin">Dashboard</Link>}</>;
 const account=<>{user ? <><NotificationBell/><Link className="ga-login-link ga-account-name" href="/account">{user.fullName}</Link><button className="ga-button ga-button-small" onClick={async()=>{try{await logout();router.push("/");setOpen(false);}catch{setError(t("Chưa đăng xuất được. Vui lòng thử lại."));}}}>{t("Đăng xuất")}</button></> : !loading && <><Link className="ga-login-link" href="/login">{t("Đăng nhập")}</Link><Link className="ga-button ga-button-small" href="/register">{t("Chung tay ↗")}</Link></>}</>;
 return <><header className="ga-header"><div className="ga-container ga-header-inner"><Link className="ga-logo" href="/" onClick={goHome} aria-label={t("Give-AID, trang chủ")}><img className="ga-logo-image" src="/giveaid-logo-transparent.png" alt="Give-AID"/></Link><nav className="ga-nav" aria-label={t("Điều hướng chính")}>{links}</nav><div className="nt-mobile-bell"><NotificationBell/></div><div className="ga-header-actions"><LanguageSwitch/>{account}</div><details className="ga-mobile-menu" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary aria-label={t("Mở menu")}>☰</summary><nav aria-label={t("Điều hướng di động")} onClick={e=>{if((e.target as HTMLElement).closest("a"))setOpen(false);}}><LanguageSwitch/>{links}{account}</nav></details></div></header>{error && <div className="ga-container notice error" role="alert">{error}<button className="quiet" onClick={()=>setError("")}>{t("Đóng")}</button></div>}</>;
}
export function Footer() {
  const { t } = useLocale();
  const goHome=(event:React.MouseEvent<HTMLAnchorElement>)=>{if(window.location.pathname==="/"){event.preventDefault();window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});}};
  return <footer className="ga-footer"><div className="ga-container"><div className="ga-footer-top"><div><Link className="ga-logo ga-footer-logo" href="/" onClick={goHome} aria-label={t("Give-AID, trang chủ")}><img className="ga-logo-image" src="/giveaid-logo-transparent.png" alt="Give-AID"/></Link><p>{t("Một nơi để những tấm lòng gặp nhau")}<br/>{t("và cùng tạo nên thay đổi.")}</p></div><div><strong>{t("Khám phá")}</strong><Link href="/chien-dich">{t("Chiến dịch")}</Link><Link href="/cach-tham-gia">{t("Cách tham gia")}</Link><Link href="/organizations">{t("Về chúng tôi")}</Link></div><div><strong>{t("Tham gia")}</strong><Link href="/dang-ky">{t("Tạo tài khoản")}</Link><Link href="/dang-nhap">{t("Đăng nhập")}</Link></div><div className="ga-footer-note"><strong>{t("Mỗi hành động đều có ý nghĩa.")}</strong><p>{t("Cùng nhau lan tỏa sự quan tâm đến những nơi cần được sẻ chia.")}</p></div></div><div className="ga-footer-bottom"><span>© {new Date().getFullYear()} Give-AID</span><span>{t("Cùng nhau sẻ chia ♡")}</span></div></div></footer>;
}


