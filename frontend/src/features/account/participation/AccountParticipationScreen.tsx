"use client";

import Link from "next/link";
import Protected from "@/features/auth/components/Protected";
import { StatusPill } from "@/shared/ui/StatusVisuals";
import styles from "../Account.module.css";
import view from "./VolunteerActivity.module.css";
import AccountVolunteerTasks from "./AccountVolunteerTasks";
import { ActivityList, ActivityPager, historyTime, useActivityList } from "../components/AccountActivity";
import { participationPath, registrationEndpoint, statuses, statusTone, useActivityCampaigns, type Registration } from "./VolunteerActivityData";

function Participation({ campaignFilter }: { campaignFilter?: string }) {
  const list = useActivityList<Registration>(campaignFilter
    ? `${registrationEndpoint}?${new URLSearchParams({ campaignId: campaignFilter })}` : registrationEndpoint);
  const campaigns = useActivityCampaigns(list.rows);
  const visibleRows = list.rows.filter((row) => row.status !== "WITHDRAWN");

  return <div className={styles.accountSubpage}>
    <header className={`${styles.accountPageHeading} ${styles.activityHero}`}>
      <h1>Hồ sơ tham gia</h1>
      <p>Theo dõi hồ sơ tình nguyện, xác nhận ca và phản hồi nhiệm vụ được giao.</p>
    </header>
    <ActivityList title="Hồ sơ đã gửi">
      {campaignFilter && <p><Link href={participationPath}>Xem tất cả hồ sơ</Link></p>}
      {list.error && <p role="alert">{list.error} <button type="button" onClick={list.reload}>Tải lại</button></p>}
      {list.loading && <p role="status">Đang tải hồ sơ…</p>}
      {!list.loading && !list.error && !visibleRows.length && <p>
        {campaignFilter ? "Bạn chưa có hồ sơ có thể xem cho chiến dịch này." : "Bạn chưa có hồ sơ tình nguyện nào có thể xem."}{" "}
        <Link href={campaignFilter ? `/chien-dich/${encodeURIComponent(campaignFilter)}` : "/chien-dich"}>Xem chiến dịch</Link>
      </p>}
      {!list.loading && !list.error && visibleRows.map((row) => (
        <div key={row.id}>
          <strong>{campaigns[row.campaignId] || "Chiến dịch tình nguyện"}</strong>
          <StatusPill tone={statusTone(row.status)}>{statuses[row.status] ?? row.status}</StatusPill>
          <span>Gửi lúc {historyTime(row.submittedAt)}</span>
          <Link className={view.action} href={`${participationPath}/${row.id}`}>Xem hồ sơ</Link>
        </div>
      ))}
      <ActivityPager page={list.page} next={list.rows.length === 20} disabled={list.loading} onChange={list.setPage} />
    </ActivityList>
    <AccountVolunteerTasks />
  </div>;
}

export default function AccountParticipationScreen({ campaignFilter }: { campaignFilter?: string }) {
  return <Protected><Participation key={campaignFilter || ""} campaignFilter={campaignFilter} /></Protected>;
}
