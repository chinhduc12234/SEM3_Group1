"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";

export default function Protected({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (loading || !user)
    return (
      <LocalizedTree>
        <div className="notice">Đang kiểm tra phiên đăng nhập…</div>
      </LocalizedTree>
    );
  if (admin && !user.roles.includes("ADMIN"))
    return (
      <LocalizedTree>
        <div className="notice error">
          Bạn không có quyền truy cập trang quản trị. <Link href="/organizations">Quay lại</Link>
        </div>
      </LocalizedTree>
    );
  return <>{children}</>;
}
