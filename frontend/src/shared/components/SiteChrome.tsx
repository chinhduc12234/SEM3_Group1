"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import NotificationBell from "@/features/notifications/components/NotificationBell";
export function Header() {
 const { user, loading, logout } = useAuth(); const router = useRouter(); const [error,setError]=useState("");
 const [open,setOpen]=useState(false);
 const links=<><Link href="/">Trang chủ</Link><Link href="/chien-dich">Chiến dịch</Link><Link href="/cach-tham-gia">Cách tham gia</Link><Link href="/organizations">Tổ chức</Link>{user && <Link href="/organizations/mine">Tổ chức của tôi</Link>}{user?.roles.includes("ADMIN") && <Link href="/admin">Dashboard</Link>}</>;
 const account=<>{user ? <><NotificationBell/><Link className="ga-login-link ga-account-name" href="/account">{user.fullName}</Link><button className="ga-button ga-button-small" onClick={async()=>{try{await logout();router.push("/");setOpen(false);}catch{setError("Chưa đăng xuất được. Vui lòng thử lại.");}}}>Đăng xuất</button></> : !loading && <><Link className="ga-login-link" href="/login">Đăng nhập</Link><Link className="ga-button ga-button-small" href="/register">Chung tay ↗</Link></>}</>;
 return <><header className="ga-header"><div className="ga-container ga-header-inner"><Link className="ga-logo" href="/" aria-label="Give-AID, trang chủ"><span className="ga-logo-mark">✳</span> Give<span>AID</span><small>CÙNG SẺ CHIA, CÙNG THAY ĐỔI</small></Link><nav className="ga-nav" aria-label="Điều hướng chính">{links}</nav><div className="nt-mobile-bell"><NotificationBell/></div><div className="ga-header-actions">{account}</div><details className="ga-mobile-menu" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary aria-label="Mở menu">☰</summary><nav aria-label="Điều hướng di động" onClick={e=>{if((e.target as HTMLElement).closest("a"))setOpen(false);}}>{links}{account}</nav></details></div></header>{error && <div className="ga-container notice error" role="alert">{error}<button className="quiet" onClick={()=>setError("")}>Đóng</button></div>}</>;
}
export function Footer() {
  return <footer className="ga-footer"><div className="ga-container"><div className="ga-footer-top"><div><Link className="ga-logo ga-footer-logo" href="/">✳ Give<span>AID</span></Link><p>Một nơi để những tấm lòng gặp nhau<br/>và cùng tạo nên thay đổi.</p></div><div><strong>Khám phá</strong><Link href="/chien-dich">Chiến dịch</Link><Link href="/cach-tham-gia">Cách tham gia</Link><Link href="/organizations">Về chúng tôi</Link></div><div><strong>Tham gia</strong><Link href="/dang-ky">Tạo tài khoản</Link><Link href="/dang-nhap">Đăng nhập</Link></div><div className="ga-footer-note"><strong>Mỗi hành động đều có ý nghĩa.</strong><p>Cùng nhau lan tỏa sự quan tâm đến những nơi cần được sẻ chia.</p></div></div><div className="ga-footer-bottom"><span>© {new Date().getFullYear()} Give-AID</span><span>Cùng nhau sẻ chia ♡</span></div></div></footer>;
}


