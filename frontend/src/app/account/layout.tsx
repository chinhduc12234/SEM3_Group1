"use client";
import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AccountAvatar from "@/shared/components/AccountAvatar";
import { useAuth } from "@/features/auth/components/AuthProvider";
import "./account-area.css";

const sections = [
  ["/account", "Hồ sơ cá nhân", "◉", "Tài khoản"],
  ["/account/security", "Bảo mật", "◇", "An toàn tài khoản"],
  ["/account/payments", "Thanh toán", "₫", "Ví & ngân hàng"],
  ["/account/history", "Lịch sử tham gia", "◷", "Đóng góp & hoạt động"],
  ["/account/policies", "Chính sách", "§", "Quyền lợi & quy định"]
];
export default function AccountLayout({ children }: { children: ReactNode }) {
  const path = usePathname(); const { user } = useAuth();
  return <div className="account-area-layout"><aside className="account-sidebar">
    <div className="account-sidebar-user"><AccountAvatar userId={user?.id ?? ""} name={user?.fullName ?? "User"}/><div><strong>{user?.fullName ?? "Tài khoản"}</strong><small>Không gian cá nhân</small></div></div>
    <p className="account-sidebar-label">TÀI KHOẢN CỦA TÔI</p>
    <nav aria-label="Điều hướng tài khoản">{sections.slice(0,4).map(([href,label,icon,description])=><Link key={href} href={href} aria-current={path===href?"page":undefined}><span className="account-nav-icon">{icon}</span><span><strong>{label}</strong><small>{description}</small></span>{path===href&&<i/>}</Link>)}</nav>
    <p className="account-sidebar-label account-sidebar-label-lower">HỖ TRỢ & QUY ĐỊNH</p>
    <nav aria-label="Hỗ trợ và quy định">{sections.slice(4).map(([href,label,icon,description])=><Link key={href} href={href} aria-current={path===href?"page":undefined}><span className="account-nav-icon">{icon}</span><span><strong>{label}</strong><small>{description}</small></span>{path===href&&<i/>}</Link>)}</nav>
    <div className="account-sidebar-note"><span>✦</span><p>Mỗi đóng góp của bạn đều góp phần tạo nên thay đổi tích cực.</p></div>
  </aside><div className="account-area-content">{children}</div></div>;
}
