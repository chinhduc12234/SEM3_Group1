import { Checklist, field, person, quantity, replace } from "./OperationsFields";
import type { EditPlan, OperationsView, Plan, Team } from "./operationsTypes";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import styles from "../CampaignManagement.module.css";

export default function OperationsTeams({ plan, view, edit }: {
  plan: Plan; view: OperationsView; edit: EditPlan;
}) {
  return <LocalizedTree>
    {plan.teams.length === 0 && <p>Chưa có đội.</p>}
    {plan.teams.map((team, index) => {
      function update(values: Partial<Team>) {
        edit((p) => ({ ...p, teams: replace(p.teams, team.id, values) }));
      }
      return <div className={styles.operationsItem} key={team.id}>
        <h4>{team.name || `Đội ${index + 1}`}</h4>
        <div className={styles.operationsFields}>
          {field("Tên đội", team.name, (name) => update({ name }))}
          {person("Trưởng đội", view.members.filter((member) => member.canLeadTeam), team.leadUserId, (leadUserId) =>
            update({ leadUserId, staffUserIds: team.staffUserIds.filter((id) => id !== leadUserId) }),
            "Người vận hành không thể làm trưởng đội")}
          {field("Nhiệm vụ của đội", team.duties, (duties) => update({ duties }), "textarea")}
          {field("Kỹ năng hoặc điều kiện tình nguyện", team.volunteerSkills, (volunteerSkills) => update({ volunteerSkills }), "textarea")}
          {quantity("Nhân sự nội bộ dự kiến", team.staffNeeded, (staffNeeded) => update({ staffNeeded }))}
          {quantity("Tình nguyện viên dự kiến", team.volunteersNeeded, (volunteersNeeded) => update({ volunteersNeeded }))}
        </div>
        <Checklist label="Nhân sự nội bộ hỗ trợ" options={view.members.filter((m) => m.userId !== team.leadUserId)
          .map(({ userId, fullName }) => ({ id: userId, name: fullName }))}
          values={team.staffUserIds.filter((id) => id !== team.leadUserId)} change={(staffUserIds) => update({ staffUserIds })} />
        <p>Đã bố trí {new Set([team.leadUserId, ...team.staffUserIds].filter(Boolean)).size}/{team.staffNeeded} nhân sự nội bộ · {team.volunteersNeeded} tình nguyện viên dự kiến</p>
        {plan.volunteerGroups.some((group) => group.teamId === team.id) && <p>Nhóm do đội phụ trách: {
          plan.volunteerGroups.filter((group) => group.teamId === team.id)
            .map((group) => `${group.name || "Chưa đặt tên"} (${group.volunteerCount} người dự kiến)`).join(", ")}</p>}
        {view.canEdit && <button type="button" className="quiet" onClick={() => edit((p) => ({
          ...p, teams: p.teams.filter((item) => item.id !== team.id),
          volunteerGroups: p.volunteerGroups.map((r) => r.teamId === team.id ? { ...r, teamId: null } : r),
          days: p.days.map((item) => item.activities.some((a) => a.teamIds.includes(team.id)) ? {
            ...item, activitiesDone: false, activities: item.activities.map((a) => ({
              ...a, teamIds: a.teamIds.filter((id) => id !== team.id),
            })),
          } : item),
        }))}>Bỏ đội</button>}
      </div>;
    })}
    {view.canEdit && <button type="button" className="secondary" onClick={() => edit((p) => ({
      ...p, teams: [...p.teams, { id: crypto.randomUUID(), name: "", duties: "", leadUserId: null,
        staffNeeded: 0, volunteersNeeded: 0, volunteerSkills: "", staffUserIds: [] }],
    }))}>Thêm đội</button>}
  </LocalizedTree>;
}
