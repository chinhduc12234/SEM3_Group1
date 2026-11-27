import { dayLabel, field, quantity, replace } from "./OperationsFields";
import type { EditPlan, OperationsView, Plan, VolunteerGroup } from "./operationsTypes";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import styles from "../CampaignManagement.module.css";

export default function OperationsVolunteerGroups({ plan, view, activities, teams, edit }: {
  plan: Plan; view: OperationsView; activities: { day: Plan["days"][number]; activity: Plan["days"][number]["activities"][number] }[];
  teams: { id: string; name: string }[]; edit: EditPlan;
}) {
  return <LocalizedTree>
    <p className="muted">Phân bổ số tình nguyện viên dự kiến cho từng đội, ngày và hoạt động.</p>
    {plan.volunteerGroups.length === 0 && <p>Chưa có nhóm tình nguyện.</p>}
    {plan.volunteerGroups.map((group) => {
      function update(values: Partial<VolunteerGroup>) {
        edit((p) => ({ ...p, volunteerGroups: replace(p.volunteerGroups, group.id, values) }));
      }
      const linkedActivity = activities.find(({ activity }) => activity.id === group.activityId)?.activity;
      const eligibleTeams = linkedActivity ? teams.filter(({ id }) => linkedActivity.teamIds.includes(id)) : teams;
      const selectedTeam = plan.teams.find((team) => team.id === group.teamId);
      return <div className={styles.operationsItem} key={group.id}>
        <h4>{group.name || "Nhóm chưa đặt tên"}</h4>
        <div className={styles.operationsFields}>
          {field("Tên nhóm", group.name, (name) => update({ name }))}
          <label>Loại nhóm
            <select value={group.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
              <option value="">Chọn loại nhóm</option>
              {view.volunteerGroupCategories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          {quantity("Số tình nguyện viên dự kiến", group.volunteerCount, (volunteerCount) => update({ volunteerCount }))}
          <label><input type="checkbox" checked={group.isPriority ?? false} onChange={(event) => update({ isPriority: event.target.checked })} /> Ưu tiên lấp suất</label>
          <label>Mức xác nhận tối thiểu để bắt đầu
            <input type="number" min={0} max={group.volunteerCount} value={group.minimumConfirmed ?? ""}
              placeholder={group.isPriority ? String(group.volunteerCount) : "0"}
              onChange={(event) => update({ minimumConfirmed: event.target.value === "" ? null : event.target.valueAsNumber })} />
          </label>
          <label><input type="checkbox" checked={group.requiresReview ?? false} onChange={(event) => update({ requiresReview: event.target.checked })} /> Cần điều phối viên xác minh trước khi xếp</label>
          <label>Ngày tham gia
            <select value={group.dayId ?? ""} onChange={(e) => update({ dayId: e.target.value || null, activityId: null })}>
              <option value="">Chọn ngày</option>
              {plan.days.map((day, index) => <option key={day.id} value={day.id}>{dayLabel(day, index)}</option>)}
            </select>
          </label>
          <label>Hoạt động hỗ trợ
            <select value={group.activityId ?? ""} onChange={(e) => {
              const item = activities.find(({ activity }) => activity.id === e.target.value);
              const teamId = item && !item.activity.teamIds.includes(group.teamId ?? "") ? null : group.teamId;
              update({ activityId: item?.activity.id ?? null, dayId: item?.day.id ?? group.dayId, teamId });
            }}>
              <option value="">Hỗ trợ cả ngày</option>
              {activities.filter(({ day }) => !group.dayId || day.id === group.dayId).map(({ day, activity }) =>
                <option key={activity.id} value={activity.id}>{day.title} · {activity.title || "Hoạt động chưa đặt tên"}</option>)}
            </select>
          </label>
          <label>Đội phụ trách
            <select value={group.teamId ?? ""} onChange={(e) => update({ teamId: e.target.value || null })}>
              <option value="">Chọn đội</option>
              {eligibleTeams.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
            {selectedTeam && <small>Chỉ tiêu của đội: {selectedTeam.volunteersNeeded} người.</small>}
            {linkedActivity && !eligibleTeams.length && <small>Hãy gán đội cho hoạt động trước.</small>}
          </label>
          {field("Ghi chú", group.notes, (notes) => update({ notes }), "textarea")}
        </div>
        {view.canEdit && <button type="button" className="quiet" onClick={() => edit((p) => ({
          ...p, volunteerGroups: p.volunteerGroups.filter((item) => item.id !== group.id),
        }))}>Bỏ nhóm</button>}
      </div>;
    })}
    {view.canEdit && <button type="button" className="secondary" onClick={() => edit((p) => {
      let index = 1;
      while (p.volunteerGroups.some((group) => group.name === `Nhóm ${index}`)) index++;
      return { ...p, volunteerGroups: [...p.volunteerGroups, {
        id: crypto.randomUUID(), categoryId: "", name: `Nhóm ${index}`, volunteerCount: 1,
        dayId: null, activityId: null, teamId: null, notes: "",
      }] };
    })}>Thêm nhóm tình nguyện</button>}
  </LocalizedTree>;
}
