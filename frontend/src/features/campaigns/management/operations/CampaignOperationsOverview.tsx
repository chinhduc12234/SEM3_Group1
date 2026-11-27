import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/shared/api/api";
import type { Campaign } from "../../types/campaigns";
import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "../CampaignManagement.module.css";
import type { OperationsView } from "./operationsTypes";
import OperationsStatusBadge from "./OperationsStatusBadge";
import CampaignRouteMap from "../../components/itinerary/CampaignRouteMap";
import { operationsRouteStops } from "./operationsRouteStops";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import { ActivityPhotoReportList, useActivityPhotoReports } from "./ActivityPhotoReports";

const sections = ["Ngày triển khai", "Hoạt động theo ngày", "Đội và nhân sự", "Nhóm tình nguyện"];

function OverviewSection({ title, children }: { title: string; children?: ReactNode }) {
  return <section className={styles.reviewBlock}>
    <h3>{title}</h3>
    {children || <p className="muted">Chờ cập nhật</p>}
  </section>;
}

export default function CampaignOperationsOverview({ campaign, loadMapOnDemand = false }: { campaign: Campaign; loadMapOnDemand?: boolean }) {
  const { id, status } = campaign;
  const { data } = useWorkspace();
  const [view, setView] = useState<OperationsView>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [showMap, setShowMap] = useState(!loadMapOnDemand);
  const planning = ["PLANNING", "PENDING_FINAL_REVIEW", "FINAL_APPROVED", "FINAL_REJECTED"].includes(status) ||
    (status === "PUBLISHED" && !!campaign.concept);
  const showReports = planning && data.roles.includes("OWNER");
  const photos = useActivityPhotoReports(id, showReports);

  useEffect(() => {
    if (!planning) return;
    const controller = new AbortController();
    api<OperationsView>(`/api/campaigns/${id}/operations`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setView(result); })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id, planning, retry]);

  const confirmed = view?.confirmedAt;
  const days = view && confirmed ? view.plan.days : [];
  const activityDays = days.filter((day) => day.activities.length);
  const teams = view && confirmed ? view.plan.teams : [];
  const groups = view && confirmed ? view.plan.volunteerGroups : [];
  const stops = operationsRouteStops(days, campaign);
  const memberNames = new Map(view?.members.map((member) => [member.userId, member.fullName]));
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const categoryNames = new Map(view?.volunteerGroupCategories.map((category) => [category.id, category.name]));
  const activityNames = new Map(days.flatMap((day) => day.activities.map((activity) => [activity.id, activity.title] as const)));
  const dayNames = new Map(days.map((day) => [day.id, formatCampaignDate(day.date)]));
  const person = (id: string | null) => id ? memberNames.get(id) || "Nhân sự không còn hoạt động" : "Chưa chỉ định";

  return <div>
    {showReports && <section id="activity-reports" className={styles.reviewBlock} style={{ scrollMarginTop: "8rem" }}>
      <h3>Báo cáo ảnh hoạt động</h3>
      {photos.error ? <p className="notice error" role="alert">{photos.error} <button type="button" className="quiet"
        onClick={photos.reload}>Tải lại</button></p> : !photos.reports ? <p role="status">Đang tải báo cáo ảnh…</p> :
        photos.reports.length === 0 ? <p className="muted">Chưa có báo cáo ảnh từ nhân sự vận hành.</p> :
        <ActivityPhotoReportList campaignId={id} reports={photos.reports} showActivity />}
    </section>}
    {confirmed && <div className={styles.detailOperationsHeader}>
        <OperationsStatusBadge confirmedAt={confirmed} />
        <p className="muted">{view?.confirmedByName || "Quản lý vận hành"} · <time dateTime={confirmed}>
          {new Date(confirmed).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
        </time></p>
    </div>}
    {error ? <p className="notice error" role="alert">{error} <button type="button" className="quiet"
      onClick={() => { setError(""); setRetry((count) => count + 1); }}>Tải lại</button></p> :
      planning && !view ? <p role="status">Đang tải kế hoạch vận hành…</p> :
      !confirmed ? <div className={styles.detailAssignments}>
        {sections.map((title) => <OverviewSection key={title} title={title} />)}
      </div> :
      <>
      {stops.length > 0 && <OverviewSection title="Bản đồ triển khai">
        {showMap ? <CampaignRouteMap stops={stops} province="" /> :
          <button type="button" className="secondary" onClick={() => setShowMap(true)}>Mở bản đồ triển khai</button>}
      </OverviewSection>}
      <div className={styles.detailOperationsGrid}>
        <OverviewSection title={sections[0]}>
          {days.length > 0 && days.map((day) => <details className={styles.operationsSummaryItem} key={day.id}>
            <summary>{dayNames.get(day.id)} · {day.title}</summary>
            {day.objective && <p><strong>Mục tiêu</strong> · {day.objective}</p>}
            {day.description && <p>{day.description}</p>}
            {day.location && <p><strong>Địa điểm</strong> · {day.location}</p>}
            <p><strong>Người phụ trách</strong> · {person(day.leadUserId)}</p>
            {day.notes && <p><strong>Ghi chú</strong> · {day.notes}</p>}
            {day.extraReason && <p><strong>Lý do bổ sung</strong> · {day.extraReason}</p>}
          </details>)}
        </OverviewSection>
        <OverviewSection title={sections[1]}>
          {activityDays.length > 0 && activityDays.map((day) => <details className={styles.operationsSummaryItem} key={day.id}>
            <summary>{dayNames.get(day.id)} · {day.title} ({day.activities.length})</summary>
            <ul>{day.activities.map((activity) => <li key={activity.id}>
              <strong>{activity.title}</strong>
              {activity.start && activity.end && <p>{activity.start.slice(0, 5)} – {activity.end.slice(0, 5)}</p>}
              {activity.location && <p>{activity.location}</p>}
              {activity.tasks && <p>{activity.tasks}</p>}
              <p><strong>Người phụ trách</strong> · {person(activity.leadUserId)}</p>
              {activity.backupUserId && <p><strong>Người thay thế</strong> · {person(activity.backupUserId)}</p>}
              {activity.teamIds.length > 0 && <p><strong>Đội phụ trách</strong> · {activity.teamIds.map((id) => teamNames.get(id)).filter(Boolean).join(", ")}</p>}
              <p>{activity.staffNeeded} nhân sự · {activity.volunteersNeeded} tình nguyện viên dự kiến</p>
              {activity.attendance ? <dl>
                <dt>Nhân sự</dt><dd>{activity.staffNeeded} cần · {activity.attendance.staffConfirmed} đã xác nhận · {activity.attendance.staffPresent} có mặt</dd>
                <dt>Tình nguyện viên</dt><dd>{activity.volunteersNeeded} cần · {activity.attendance.volunteersConfirmed} đã xác nhận · {activity.attendance.volunteersPresent} có mặt</dd>
              </dl> : <p className="muted">Chưa ghi nhận quân số thực tế.</p>}
            </li>)}</ul>
          </details>)}
        </OverviewSection>
        <OverviewSection title={sections[2]}>
          {teams.length > 0 && teams.map((team) => <details className={styles.operationsSummaryItem} key={team.id}>
            <summary>{team.name}</summary>
            {team.duties && <p>{team.duties}</p>}
            <p><strong>Trưởng đội</strong> · {person(team.leadUserId)}</p>
            {team.staffUserIds.length > 0 && <p><strong>Nhân sự hỗ trợ</strong> · {team.staffUserIds.map(person).join(", ")}</p>}
            <p>{team.staffNeeded} nhân sự · {team.volunteersNeeded} tình nguyện viên dự kiến</p>
            {team.volunteerSkills && <p><strong>Kỹ năng tình nguyện viên</strong> · {team.volunteerSkills}</p>}
          </details>)}
        </OverviewSection>
        <OverviewSection title={sections[3]}>
          {groups.length > 0 && groups.map((group) => <details className={styles.operationsSummaryItem} key={group.id}>
            <summary>{group.name} · {group.volunteerCount} người</summary>
            <p>{categoryNames.get(group.categoryId)}</p>
            <p><strong>Đội phụ trách</strong> · {group.teamId && teamNames.get(group.teamId) || "Chưa chỉ định"}</p>
            <p><strong>Ngày triển khai</strong> · {group.dayId && dayNames.get(group.dayId) || "Dùng chung"}</p>
            {group.activityId && <p><strong>Hoạt động</strong> · {activityNames.get(group.activityId)}</p>}
            {group.notes && <p><strong>Ghi chú</strong> · {group.notes}</p>}
          </details>)}
        </OverviewSection>
      </div></>}
  </div>;
}
