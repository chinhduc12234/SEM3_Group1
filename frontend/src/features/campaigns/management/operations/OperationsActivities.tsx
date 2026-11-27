import ops from "./OperationsDashboard.module.css";
import { ActivityPhotoSection, type useActivityPhotoReports } from "./ActivityPhotoReports";
import { Checklist, field, person, quantity, replace } from "./OperationsFields";
import type { Activity, Day, EditPlan, OperationsView, Plan } from "./operationsTypes";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import styles from "../CampaignManagement.module.css";

export default function OperationsActivities({ selectedDay, plan, view, teams, campaignId, photoReports, edit, save }: {
  selectedDay?: Day; plan: Plan; view: OperationsView; teams: { id: string; name: string }[]; campaignId: string;
  photoReports: ReturnType<typeof useActivityPhotoReports>; edit: EditPlan; save: (confirm: boolean, finishedDay?: Day) => Promise<void>;
}) {
  return <LocalizedTree>
    {!selectedDay && <p>Hãy thêm ngày triển khai để lập hoạt động.</p>}
    {selectedDay && (() => {
      const day = selectedDay;
      function update(values: Partial<Day>) {
        edit((p) => ({ ...p, days: replace(p.days, day.id, { ...values, activitiesDone: false }) }));
      }
      return <div>
        {day.activities.length === 0 && <p>Ngày này chưa có hoạt động.</p>}
        {day.activities.map((activity, activityIndex) => {
          function updateActivity(values: Partial<Activity>) {
            update({ activities: replace(day.activities, activity.id, values) });
            const updatedTeams = values.teamIds;
            if (updatedTeams) {
              edit((p) => ({ ...p, volunteerGroups: p.volunteerGroups.map((r) =>
                r.activityId === activity.id && r.teamId && !updatedTeams.includes(r.teamId) ? { ...r, teamId: null } : r) }));
            }
          }
          const activeTeams = plan.teams.filter((team) => activity.teamIds.includes(team.id));
          const assignedStaff = new Set(activeTeams.flatMap((team) => [team.leadUserId, ...team.staffUserIds]).filter(Boolean));
          if (activity.leadUserId) assignedStaff.add(activity.leadUserId);
          const volunteerTarget = activeTeams.reduce((count, team) => count + team.volunteersNeeded, 0);
          const linkedGroups = plan.volunteerGroups.filter((group) => group.activityId === activity.id);
          const saved = view.plan.days.some((day) => day.activities.some((item) => item.id === activity.id));
          const reports = photoReports.reports?.filter((report) => report.activityId === activity.id) ?? [];
          return <article key={activity.id} className={ops.activity}>
            <header className={ops.activityHeader}>
              <h4>{activity.title || `Hoạt động ${activityIndex + 1}`}</h4>
              <p>{activity.start && activity.end ? `${activity.start.slice(0, 5)} – ${activity.end.slice(0, 5)}` : "Chưa đặt giờ"}
                {activity.location && ` · ${activity.location}`}</p>
            </header>
            <div className={ops.activityBody}>
            <fieldset className={styles.conceptForm} disabled={!view.canEdit}>
            <div className={styles.operationsFields}>
              {field("Tên hoạt động", activity.title, (title) => updateActivity({ title }))}
              {field("Địa điểm", activity.location, (location) => updateActivity({ location }))}
              {field("Giờ bắt đầu", activity.start, (start) => updateActivity({ start: start ? `${start}:00` : null }), "time")}
              {field("Giờ kết thúc", activity.end, (end) => updateActivity({ end: end ? `${end}:00` : null }), "time")}
              {person("Người phụ trách", view.members, activity.leadUserId, (leadUserId) => updateActivity({ leadUserId }))}
              {person("Người thay thế", view.members, activity.backupUserId ?? null, (backupUserId) => updateActivity({ backupUserId }))}
              {field("Nhiệm vụ", activity.tasks, (tasks) => updateActivity({ tasks }), "textarea")}
              {quantity("Nhân sự nội bộ cần", activity.staffNeeded, (staffNeeded) => updateActivity({ staffNeeded }))}
              {quantity("Tình nguyện viên cần", activity.volunteersNeeded, (volunteersNeeded) => updateActivity({ volunteersNeeded }))}
            </div>
            <Checklist label="Đội tham gia" options={teams} values={activity.teamIds} change={(teamIds) => updateActivity({ teamIds })} />
            {activeTeams.length > 0 && <div className={styles.operationsCoverage}>
              <p>Đã bố trí {assignedStaff.size}/{activity.staffNeeded} nhân sự nội bộ · Chỉ tiêu tình nguyện của các đội {volunteerTarget}/{activity.volunteersNeeded}</p>
              <ul>{activeTeams.map((team) => <li key={team.id}>
                {team.name || "Đội chưa đặt tên"} · Trưởng đội {view.members.find((m) => m.userId === team.leadUserId)?.fullName || "chưa chọn"}
                { ` · ${team.staffUserIds.filter((id) => id !== team.leadUserId).length} người hỗ trợ · ${team.volunteersNeeded} tình nguyện viên dự kiến`}
              </li>)}</ul>
            </div>}
            {linkedGroups.length > 0 && <p>Nhóm tình nguyện: {linkedGroups.map((group) =>
              `${group.name || "Chưa đặt tên"} (${group.volunteerCount} người dự kiến)`).join(", ")}</p>}
            {view.canEdit && <button type="button" className="quiet" onClick={() => edit((p) => ({
              ...p, days: replace(p.days, day.id, { activities: day.activities.filter((item) => item.id !== activity.id), activitiesDone: false }),
              volunteerGroups: p.volunteerGroups.map((r) => r.activityId === activity.id ? { ...r, activityId: null } : r),
            }))}>Bỏ hoạt động</button>}
            </fieldset>
            <ActivityPhotoSection campaignId={campaignId} activityId={activity.id} saved={saved} reports={reports}
              error={photoReports.error} reload={photoReports.reload} onSent={photoReports.add} />
            </div>
          </article>;
        })}
        {view.canEdit && <div className="actions">
          <button type="button" className="secondary" onClick={() => update({ activities: [...day.activities, {
            id: crypto.randomUUID(), title: "", start: null, end: null, location: day.location, tasks: "",
            leadUserId: null, staffNeeded: 0, volunteersNeeded: 0, teamIds: [],
          }] })}>Thêm hoạt động</button>
          <button type="button" disabled={day.activitiesDone} onClick={() => void save(false, day)}>Xong ngày</button>
        </div>}
      </div>;
    })()}
  </LocalizedTree>;
}
