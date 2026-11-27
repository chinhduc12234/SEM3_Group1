"use client";

import Link from "next/link";
import { useMemo } from "react";
import Protected from "@/features/auth/components/Protected";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { StatusPill } from "@/shared/ui/StatusVisuals";
import styles from "../Account.module.css";
import { ActivityList, ActivityPager, historyTime, useActivityList } from "../components/AccountActivity";
import { useActivityCampaigns } from "./VolunteerActivityData";

type ParticipationHistory = {
  campaignId: string; lastParticipationAt: string; attendanceCount: number; completedTaskCount: number;
};
type RemovalHistory = { registrationId: string; campaignId: string; removedAt: string };

function History({ removalId }: { removalId?: string }) {
  const list = useActivityList<ParticipationHistory>("/api/volunteers/me/participation-history");
  const removals = useActivityList<RemovalHistory>(removalId
    ? `/api/volunteers/me/removal-history?${new URLSearchParams({ registrationId: removalId })}`
    : "/api/volunteers/me/removal-history");
  const activityRows = useMemo(() => [...list.rows, ...removals.rows], [list.rows, removals.rows]);
  const campaigns = useActivityCampaigns(activityRows);

  return <LocalizedTree><div className={styles.accountSubpage}>
    <header className={`${styles.accountPageHeading} ${styles.activityHero}`}>
      <h1>Lịch sử tham gia</h1>
      <p>Xem các chiến dịch đã tham gia và những lần bị gỡ quyền tình nguyện viên.</p>
    </header>
    {(removalId || removals.rows.length > 0 || removals.error) && <ActivityList title="Lịch sử gỡ quyền tình nguyện viên">
      {removalId && <p><Link href="/account/history">Xem tất cả lịch sử gỡ quyền</Link></p>}
      {removals.error && <p role="alert">{removals.error} <button type="button" onClick={removals.reload}>Tải lại</button></p>}
      {removals.loading && <p role="status">Đang tải lịch sử…</p>}
      {!removals.loading && !removals.error && removals.rows.length === 0 && <p>Không tìm thấy lượt gỡ quyền tình nguyện viên.</p>}
      {!removals.loading && !removals.error && removals.rows.map((row) => (
        <div key={row.registrationId}>
          <strong>{campaigns[row.campaignId] || "Chiến dịch tình nguyện"}</strong>
          <StatusPill tone="danger">Đã bị gỡ quyền tình nguyện viên</StatusPill>
          <time dateTime={row.removedAt}>{historyTime(row.removedAt)}</time>
        </div>
      ))}
      {!removalId && <ActivityPager page={removals.page} next={removals.rows.length === 20} disabled={removals.loading} onChange={removals.setPage} />}
    </ActivityList>}
    <ActivityList title="Chiến dịch đã tham gia">
      {list.error && <p role="alert">{list.error} <button type="button" onClick={list.reload}>Tải lại</button></p>}
      {list.loading && <p role="status">Đang tải lịch sử…</p>}
      {!list.loading && !list.error && !list.rows.length && <p>
        Chưa có chiến dịch nào được ghi nhận tham gia. <Link href="/chien-dich">Khám phá chiến dịch</Link>
      </p>}
      {!list.loading && !list.error && list.rows.map((row) => (
        <div key={row.campaignId}>
          <strong>{campaigns[row.campaignId] || "Chiến dịch tình nguyện"}</strong>
          <span>Lần gần nhất {historyTime(row.lastParticipationAt)}</span>
          {row.attendanceCount > 0 && <span>{row.attendanceCount} lượt có mặt</span>}
          {row.completedTaskCount > 0 && <span>{row.completedTaskCount} nhiệm vụ hoàn thành</span>}
        </div>
      ))}
      <ActivityPager page={list.page} next={list.rows.length === 20} disabled={list.loading} onChange={list.setPage} />
    </ActivityList>
  </div></LocalizedTree>;
}

export default function AccountHistoryScreen({ removalId }: { removalId?: string }) {
  return <Protected><History key={removalId} removalId={removalId} /></Protected>;
}
