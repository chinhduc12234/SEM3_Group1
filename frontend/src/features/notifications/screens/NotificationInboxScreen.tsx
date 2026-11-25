"use client";
import notificationsStyles from "@/features/notifications/Notifications.module.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Protected from "@/features/auth/components/Protected";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import { useNotifications } from "@/features/notifications/components/NotificationProvider";
import type { InboxItem, InboxPage } from "@/features/notifications/types";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { StatusPill } from "@/shared/ui/StatusVisuals";

function inboxDestination(item: InboxItem) {
  const { url, kind } = item;
  if (/^\/(?:admin\/)?organizations\/[0-9a-f-]+(?:\/manage)?$/.test(url)) return url;
  if (kind === "CAMPAIGN_ASSIGNED" && /^\/organizations\/[0-9a-f-]{36}\/manage\/campaigns\?campaign=[0-9a-f-]{36}$/.test(url)) return url;
  if (kind === "ACTIVITY_PHOTO_REPORT" && /^\/organizations\/[0-9a-f-]{36}\/manage\/campaigns\/[0-9a-f-]{36}\?tab=operations#activity-reports$/.test(url)) return url;
  if (kind === "CAMPAIGN_STARTED" && /^\/organizations\/[0-9a-f-]{36}\/manage\/campaigns\/[0-9a-f-]{36}\/readiness$/.test(url)) return url;
  if (kind === "CAMPAIGN_SCHEDULE_CHANGED" && /^\/chien-dich\/[0-9a-f-]{36}$/.test(url)) return url;
  if (kind.startsWith("VOLUNTEER_REGISTRATION_") && (
    /^\/account\/history\?registration=[0-9a-f-]{36}$/.test(url) ||
    /^\/organizations\/[0-9a-f-]{36}\/manage\/operations\/[0-9a-f-]{36}$/.test(url))) return url;
  if ((kind.startsWith("IN_KIND_PLEDGE_") || kind === "DONATION_CONFIRMED" || kind === "FUNDRAISING_GOAL_REACHED") && (
    /^\/account\/payments\?(?:pledge|payment)=[0-9a-f-]{36}$/.test(url) ||
    /^\/organizations\/[0-9a-f-]{36}\/manage\/budget\/[0-9a-f-]{36}$/.test(url))) return url;
  return null;
}

export default function NotificationInboxScreen() {
  return (
    <Protected>
      <Inbox />
    </Protected>
  );
}
function Inbox() {
  const { user } = useAuth();
  const router = useRouter();
  const { revision, connected, pushState, busy, enablePush, disablePush, refresh } =
    useNotifications();
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [result, setResult] = useState<InboxPage | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let active = true;
    api<InboxPage>(`/api/notifications?page=${page}&unread=${unread}`)
      .then((data) => {
        if (active) {
          setResult(data);
          setError("");
        }
      })
      .catch((ex) => {
        if (active) setError(ex.message);
      });
    return () => {
      active = false;
    };
  }, [page, unread, revision, user?.id]);
  async function open(item: InboxItem) {
    setWorking(true);
    setError("");
    try {
      await api(`/api/notifications/${item.id}/read`, { method: "PUT" });
      await refresh();
      const destination = inboxDestination(item);
      if (destination) router.push(destination);
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function readAll() {
    if (!result) return;
    setWorking(true);
    try {
      await api("/api/notifications/read-all", {
        method: "PUT",
        body: JSON.stringify({ through: result.asOf }),
      });
      await refresh();
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <LocalizedTree>
      <section className={notificationsStyles.inbox}>
        <div className={`page-title ${notificationsStyles.inboxHero}`}>
          <div>
            <h1>Thông báo</h1>
            <div className={notificationsStyles.inboxLabels}>
              {result && <StatusPill tone={result.unreadCount ? "info" : "neutral"}>{result.unreadCount} chưa đọc</StatusPill>}
              <StatusPill tone={connected ? "positive" : "neutral"}>{connected ? "Đã kết nối" : "Đang kết nối"}</StatusPill>
            </div>
          </div>
          <button
            className="secondary"
            onClick={readAll}
            disabled={working || !result?.unreadCount}
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>
        <div className={notificationsStyles.push}>
          <div>
            <strong>Thông báo trên trình duyệt</strong>
            <p className="muted">
              Nhận cập nhật hồ sơ khi đang ở tab khác. Bạn có thể bật hoặc tắt bất cứ lúc nào.
            </p>
          </div>
          <div className={notificationsStyles.actions}>
            <button disabled={busy} onClick={enablePush}>
              Bật thông báo
            </button>
            <button className="secondary" disabled={busy} onClick={disablePush}>
              Tắt push
            </button>
          </div>
          {pushState && <p role="status">{pushState}</p>}
        </div>
        <div className={notificationsStyles.actions}>
          <button
            className={!unread ? "" : "secondary"}
            aria-pressed={!unread}
            onClick={() => {
              setUnread(false);
              setPage(1);
            }}
          >
            Tất cả
          </button>
          <button
            className={unread ? "" : "secondary"}
            aria-pressed={unread}
            onClick={() => {
              setUnread(true);
              setPage(1);
            }}
          >
            Chưa đọc
          </button>
          <button className="quiet" onClick={() => void refresh()}>
            Tải lại
          </button>
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {!result && !error && <p>Đang tải thông báo…</p>}
        {result && (
          <>
            <ul className={notificationsStyles.list}>
              {result.items.map((item) => (
                <li key={item.id} className={item.readAt ? "" : notificationsStyles.isUnread}>
                  <button onClick={() => open(item)} disabled={working}>
                    <span className={notificationsStyles.dot} aria-hidden="true" />
                    <span>
                      <span className={notificationsStyles.inboxLabels}>
                        <strong>{item.title}</strong>
                        {!item.readAt && <StatusPill tone="info">Chưa đọc</StatusPill>}
                      </span>
                      <span className={notificationsStyles.message}>{item.message}</span>
                      <time dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </time>
                    </span>
                    {inboxDestination(item) && <span aria-hidden="true">→</span>}
                  </button>
                </li>
              ))}
            </ul>
            {!result.items.length && (
              <p className="notice">
                {unread
                  ? "Bạn đã đọc hết thông báo."
                  : "Chưa có thông báo. Các cập nhật hồ sơ mới sẽ xuất hiện ở đây."}
              </p>
            )}
            <div className={notificationsStyles.actions}>
              <button
                className="secondary"
                disabled={page <= 1}
                onClick={() => setPage((x) => x - 1)}
              >
                Trước
              </button>
              <span>
                Trang {page} / {Math.max(1, Math.ceil(result.totalCount / 20))}
              </span>
              <button
                className="secondary"
                disabled={page * 20 >= result.totalCount}
                onClick={() => setPage((x) => x + 1)}
              >
                Sau
              </button>
            </div>
          </>
        )}
      </section>
    </LocalizedTree>
  );
}
