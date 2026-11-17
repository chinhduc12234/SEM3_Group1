import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "../CampaignManagement.module.css";
import type { OperationsView } from "./CampaignOperationsPanel";
import OperationsStatusBadge from "./OperationsStatusBadge";

const confirmationTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

export default function CampaignOperationsSummary({ view }: { view: OperationsView }) {
  if (!view.confirmedAt) return null;

  const { days, teams, volunteerGroups } = view.plan;
  const members = new Map(view.members.map(({ userId, fullName }) => [userId, fullName]));
  const categories = new Map(view.volunteerGroupCategories.map(({ id, name }) => [id, name]));
  const activityNames = new Map(days.flatMap((day) => day.activities.map((a) => [a.id, a.title] as const)));
  const dateNames = new Map(days.map((day) => [day.id, formatCampaignDate(day.date)]));
  const person = (id: string | null) => id ? members.get(id) || "Nhân sự không còn hoạt động" : "Chưa chỉ định";
  const dates = days.map((day) => day.date).filter((date): date is string => !!date).sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  const dateRange = [firstDate, ...(lastDate !== firstDate ? [lastDate] : [])].filter(Boolean)
    .map(formatCampaignDate).join(" – ");

  return <section className={styles.operationsSummary} aria-labelledby="operations-summary-title">
    <div className={styles.operationsSummaryHeader}>
      <h4 id="operations-summary-title">Tổng quan kế hoạch đã xác nhận</h4>
      <OperationsStatusBadge confirmedAt={view.confirmedAt} />
    </div>
    <p>{view.confirmedByName || "Quản lý vận hành"} · <time dateTime={view.confirmedAt}>
      {confirmationTime.format(new Date(view.confirmedAt))}
    </time></p>
    <dl className={styles.operationsSummaryStats}>
      <div><dt>Ngày triển khai</dt><dd>{days.length}</dd></div>
      <div><dt>Hoạt động</dt><dd>{activityNames.size}</dd></div>
      <div><dt>Đội phụ trách</dt><dd>{teams.length}</dd></div>
      <div><dt>Chỉ tiêu tình nguyện của các đội</dt><dd>{teams.reduce((count, team) => count + team.volunteersNeeded, 0)} người</dd></div>
    </dl>
    <div className={styles.operationsSummaryColumns}>
      <div>
        <h5>Lịch triển khai</h5>
        {dateRange && <p>{dateRange}</p>}
        {days.map((day) => <details className={styles.operationsSummaryItem} key={day.id}>
          <summary>{dateNames.get(day.id)} · {day.title} · {day.activities.length} hoạt động</summary>
          <p>Địa điểm chính {day.location || "chưa ghi"} · Phụ trách {person(day.leadUserId)}</p>
          {day.activities.length > 0 && <ul>
            {day.activities.map((activity) => <li key={activity.id}>
              <strong>{activity.start?.slice(0, 5)} – {activity.end?.slice(0, 5)} · {activity.title}</strong>
              <br />{activity.location} · Phụ trách {person(activity.leadUserId)}
            </li>)}
          </ul>}
        </details>)}
      </div>
      <div>
        <h5>Đội và nhóm tình nguyện</h5>
        {!teams.length && <p>Chưa có đội trong kế hoạch này.</p>}
        {teams.map((team) => {
          const staff = team.staffUserIds.filter((id) => id !== team.leadUserId);
          const groups = volunteerGroups.filter((group) => group.teamId === team.id);
          return <details className={styles.operationsSummaryItem} key={team.id}>
            <summary>{team.name} · {team.volunteersNeeded} tình nguyện viên dự kiến</summary>
            <p>Trưởng đội {person(team.leadUserId)}</p>
            {staff.length > 0 && <p>Nhân sự hỗ trợ · {staff.map(person).join(", ")}</p>}
            {groups.length > 0 && <ul>
              {groups.map((group) => <li key={group.id}>
                <strong>{group.name} · {group.volunteerCount} người dự kiến</strong>
                <br />{[group.dayId && dateNames.get(group.dayId),
                  group.activityId ? activityNames.get(group.activityId) : "Hỗ trợ cả ngày",
                  categories.get(group.categoryId)].filter(Boolean).join(" · ")}
              </li>)}
            </ul>}
          </details>;
        })}
      </div>
    </div>
  </section>;
}
