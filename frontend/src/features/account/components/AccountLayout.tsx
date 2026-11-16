"use client";
import accountStyles from "@/features/account/Account.module.css";
import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AccountAvatar from "@/shared/ui/AccountAvatar";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";

const accountLinks = [
  ["/account", "Hồ sơ cá nhân", "◉", "Tài khoản"],
  ["/account/security", "Bảo mật", "◇", "An toàn tài khoản"],
  ["/account/payments", "Thanh toán", "₫", "Ví & ngân hàng"],
  ["/account/history", "Lịch sử tham gia", "◷", "Đóng góp & hoạt động"],
] as const;

const supportLinks = [["/account/policies", "Chính sách", "§", "Quyền lợi & quy định"]] as const;

type AccountLink = readonly [href: string, label: string, icon: string, description: string];

function AccountNavigation({
  label,
  links,
  path,
}: {
  label: string;
  links: readonly AccountLink[];
  path: string;
}) {
  return (
    <LocalizedTree>
      <nav aria-label={label}>
        {links.map(([href, title, icon, description]) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
            <span className={accountStyles.accountNavIcon}>{icon}</span>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            {path === href && <i />}
          </Link>
        ))}
      </nav>
    </LocalizedTree>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { user } = useAuth();
  const content = (
    <LocalizedTree>
      <div className={accountStyles.accountAreaLayout}>
        <aside className={accountStyles.accountSidebar}>
          <div className={accountStyles.accountSidebarUser}>
            <AccountAvatar userId={user?.id ?? ""} name={user?.fullName ?? "User"} />
            <div>
              <strong>{user?.fullName ?? "Tài khoản"}</strong>
              <small>Không gian cá nhân</small>
            </div>
          </div>
          <p className={accountStyles.accountSidebarLabel}>TÀI KHOẢN CỦA TÔI</p>
          <AccountNavigation label="Điều hướng tài khoản" links={accountLinks} path={path} />
          <p
            className={`${accountStyles.accountSidebarLabel} ${accountStyles.accountSidebarLabelLower}`}
          >
            HỖ TRỢ & QUY ĐỊNH
          </p>
          <AccountNavigation label="Hỗ trợ và quy định" links={supportLinks} path={path} />
          <div className={accountStyles.accountSidebarNote}>
            <span>✦</span>
            <p>Mỗi đóng góp của bạn đều góp phần tạo nên thay đổi tích cực.</p>
          </div>
        </aside>
        <div className={accountStyles.accountAreaContent}>{children}</div>
      </div>
    </LocalizedTree>
  );
  return <main className={accountStyles.accountMain}>{content}</main>;
}
