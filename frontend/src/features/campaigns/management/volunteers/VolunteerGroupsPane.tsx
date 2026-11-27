import { Legend, StatusPill } from "@/shared/ui/StatusVisuals";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { WorkspaceEmpty, WorkspaceIcon, WorkspaceLoading } from "@/features/organizations/workspace/components/WorkspaceUI";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { VolunteerCapacity } from "../../components/volunteer/VolunteerCapacity";
import type { Group, GroupMember } from "./volunteerManagementTypes";
import styles from "./VolunteerManagementPanel.module.css";

export default function VolunteerGroupsPane({ groups, selectedGroup, onSelectGroup, members, error, dateFormat }: {
  groups: Group[]; selectedGroup: string; onSelectGroup: (id: string) => void;
  members?: GroupMember[]; error: string; dateFormat: Intl.DateTimeFormat;
}) {
  const { t } = useLocale();
  const selected = groups.find((group) => group.id === selectedGroup);
  return <LocalizedTree>
    <Legend items={[{ label: t("Đã xác nhận"), tone: "positive" }, { label: t("Đã xếp, chờ xác nhận"), tone: "info" },
      { label: t("Còn trống"), tone: "neutral" }]} />
    <div className={styles.groupLayout}>
    <div className={styles.groupList} role="group" aria-label="Các nhóm trong chiến dịch">
      {groups.map((group) => <button type="button" key={group.id}
        aria-pressed={selectedGroup === group.id} className={`quiet ${styles.groupCard}`}
        onClick={() => onSelectGroup(group.id)}>
        <span className={styles.cardMeta}>{group.category} · {group.date ? dateFormat.format(new Date(`${group.date}T00:00:00Z`)) : "Lịch linh hoạt"}</span>
        <strong>{group.name}</strong>
        <span className={styles.capacity}><b>{group.assignedCount}/{group.target}</b>
          {group.remaining ? <StatusPill tone="warning">Còn {group.remaining} suất</StatusPill> : <StatusPill tone="positive">Đã xếp đủ</StatusPill>}</span>
        <VolunteerCapacity target={group.target} assigned={group.assignedCount} confirmed={group.confirmedCount} />
        <span className={styles.cardMeta}>{group.confirmedCount} đã xác nhận</span>
        {(group.activityTitle || group.teamName) && <span className={styles.cardMeta}>
          {[group.activityTitle, group.teamName].filter(Boolean).join(" · ")}</span>}
      </button>)}
      {groups.length === 0 && <WorkspaceEmpty title="Chiến dịch chưa có nhóm nào đang tuyển." icon="people" />}
    </div>
    {selected && <section className={styles.roster} aria-labelledby="group-roster-title">
        <header>
          <p className={styles.kicker}>DANH SÁCH THÀNH VIÊN</p>
          <h3 id="group-roster-title">{selected.name}</h3>
          <p>{selected.assignedCount} / {selected.target} đã xếp · {selected.confirmedCount} đã xác nhận</p>
          {(selected.activityTitle || selected.teamName) && <small>{[selected.activityTitle, selected.teamName].filter(Boolean).join(" · ")}</small>}
        </header>
        <section className={styles.teamLeader} aria-label="Trưởng nhóm, không tính vào chỉ tiêu tình nguyện viên">
          <span className={styles.leaderAvatar}><WorkspaceIcon name="people" /></span>
          <div><span className={styles.leaderLabel}>TRƯỞNG NHÓM · KHÔNG TÍNH VÀO CHỈ TIÊU</span>
            <strong>{selected.teamLeaderName || "Chưa phân công trưởng nhóm"}</strong>
            {selected.teamName && <small>{selected.teamName}</small>}</div>
        </section>
        {!members && !error && <WorkspaceLoading>Đang tải thành viên…</WorkspaceLoading>}
        {!!members?.length && <div className={styles.memberList}>{members.map((member) => <article key={member.registrationId}>
          <span className={styles.avatar} aria-hidden="true">{member.fullName.trim().charAt(0).toUpperCase()}</span>
          <div><strong>{member.fullName}</strong><small>{member.email} · {member.phoneNumber}</small></div>
        </article>)}</div>}
        {members?.length === 0 && <WorkspaceEmpty compact title="Chưa có tình nguyện viên nào được duyệt vào nhóm này." icon="people" />}
    </section>}
    </div>
  </LocalizedTree>;
}
