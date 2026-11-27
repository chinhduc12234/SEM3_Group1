"use client";
import notificationsStyles from "./NotificationBell.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { useNotifications } from "./NotificationProvider";

export default function NotificationBell({ href = "/notifications" }: { href?: string }) {
  const { user } = useAuth();
  const { inbox, error } = useNotifications();
  if (!user) return null;
  const count = inbox?.unreadCount ?? 0;
  return (
    <LocalizedTree>
      <Link
        className={notificationsStyles.bell}
        data-nt-bell=""
        href={href}
        aria-label={`Thông báo${count ? `, ${count} chưa đọc` : ""}`}
        title="Thông báo"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {count > 0 && (
          <span className={notificationsStyles.count}>{count > 99 ? "99+" : count}</span>
        )}
        {error && (
          <span className={notificationsStyles.status} title="Chưa tải được thông báo">
            !
          </span>
        )}
      </Link>
    </LocalizedTree>
  );
}
