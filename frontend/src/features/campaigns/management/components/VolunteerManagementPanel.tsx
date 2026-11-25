"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/api";
import { Legend, Stat, StatGrid, StatusPill } from "@/shared/ui/StatusVisuals";
import { VolunteerCapacity } from "../../components/VolunteerCapacity";
import ops from "./OperationsDashboard.module.css";
import styles from "./VolunteerManagementPanel.module.css";

type Group = {
  id: string; name: string; category: string; target: number; assignedCount: number; remaining: number; confirmedCount: number;
  date: string | null; activityTitle: string | null; teamName: string | null; teamLeaderName: string | null;
};
type GroupsView = {
  campaignId: string; campaignTitle: string; pendingRegistrations: number; approvedVolunteers: number; groups: Group[];
};
type GroupMember = { registrationId: string; fullName: string; email: string; phoneNumber: string; assignedAt: string; assignedBy: string };
type RegistrationSummary = {
  id: string; campaignId: string; fullName: string; email: string; phoneNumber: string; status: string;
  submittedAt: string; groupPreferences: { groupId: string; preferenceRank: number }[];
};
type RegistrationPage = { campaignId: string; status: string; page: number; pageSize: number; totalCount: number; items: RegistrationSummary[] };
type RegistrationDetail = RegistrationSummary & {
  dateOfBirth: string | null; occupation: string | null; healthNote: string | null; skills: string | null;
  experience: string | null; motivation: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null;
  commitsToAllDays: boolean; rejectionReason: string | null; reviewNote?: string | null; assignedGroups: { groupId: string; status: string }[];
};
type Pane = "groups" | "applications";

function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Lịch linh hoạt";
}

export default function VolunteerManagementPanel({ campaignId }: { campaignId: string }) {
  const [pane, setPane] = useState<Pane>("groups");
  const [status, setStatus] = useState("SUBMITTED");
  const [view, setView] = useState<GroupsView>();
  const [members, setMembers] = useState<GroupMember[]>();
  const [selectedGroup, setSelectedGroup] = useState("");
  const [applications, setApplications] = useState<RegistrationPage>();
  const [selectedRegistration, setSelectedRegistration] = useState("");
  const [detail, setDetail] = useState<RegistrationDetail>();
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<GroupsView>(`/api/volunteers/campaigns/${campaignId}/groups`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setView(result);
        setSelectedGroup((current) => result.groups.some((group) => group.id === current) ? current : result.groups[0]?.id ?? "");
      })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [campaignId, reload]);

  useEffect(() => {
    if (!selectedGroup) { setMembers([]); return; }
    const controller = new AbortController();
    setMembers(undefined);
    api<GroupMember[]>(`/api/volunteers/campaigns/${campaignId}/groups/${selectedGroup}/members`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setMembers(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [campaignId, selectedGroup, reload]);

  useEffect(() => {
    const controller = new AbortController();
    setApplications(undefined);
    setError("");
    api<RegistrationPage>(`/api/volunteers/campaigns/${campaignId}/registrations?status=${status}&page=1&pageSize=100`,
      { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setApplications(result);
        setSelectedRegistration((current) => result.items.some((item) => item.id === current) ? current : result.items[0]?.id ?? "");
      })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [campaignId, status, reload]);

  useEffect(() => {
    if (!selectedRegistration) { setDetail(undefined); return; }
    const controller = new AbortController();
    setDetail(undefined);
    api<RegistrationDetail>(`/api/volunteers/registrations/${selectedRegistration}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setDetail(result);
        // Preferences guide the reviewer; require an explicit final assignment.
        setAssignedGroupIds(result.assignedGroups.filter((item) => item.status === "ACTIVE").map((item) => item.groupId));
        setReviewNote("");
      })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [selectedRegistration, reload]);

  const selected = useMemo(() => view?.groups.find((group) => group.id === selectedGroup), [view, selectedGroup]);
  const fullGroups = view?.groups.filter((group) => group.remaining === 0).length ?? 0;
  const shortfall = view?.groups.reduce((sum, group) => sum + group.remaining, 0) ?? 0;

  async function review(decision: "APPROVE" | "WAITLIST" | "REJECT") {
    if (!detail || busy) return;
    setError("");
    setNotice("");
    if (decision === "APPROVE" && assignedGroupIds.length === 0) {
      setError("Hãy phân công ít nhất một nhóm trước khi duyệt hồ sơ.");
      return;
    }
    if (decision === "REJECT" && !reviewNote.trim()) {
      setError("Hãy ghi lý do từ chối hồ sơ.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/volunteers/registrations/${detail.id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, assignedGroupIds: decision === "APPROVE" ? assignedGroupIds : [], note: reviewNote }),
      });
      setNotice(decision === "APPROVE" ? "Đã duyệt hồ sơ và phân nhóm." : decision === "WAITLIST" ? "Đã đưa hồ sơ vào danh sách chờ." : "Đã từ chối hồ sơ.");
      setSelectedRegistration("");
      setReload((value) => value + 1);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.panel} aria-labelledby="volunteer-management-title">
    <header className={styles.heading}>
      <div><h2 id="volunteer-management-title">Điều phối tình nguyện</h2>
        {view && <p>{view.campaignTitle}</p>}</div>
      <button type="button" className="secondary" disabled={busy} onClick={() => setReload((value) => value + 1)}>Làm mới</button>
    </header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {notice && <p className="notice success" role="status">{notice}</p>}
    {!view && !error && <p role="status" className={ops.empty}>Đang tải nhóm và chỉ tiêu…</p>}
    {view && <>
      <StatGrid label="Tổng quan tuyển tình nguyện">
        <Stat label="Đã xác nhận ca" value={view.groups.reduce((sum, group) => sum + group.confirmedCount, 0)} tone="positive" />
        <Stat label="Nhóm đã xếp đủ" value={`${fullGroups}/${view.groups.length}`} tone="info" />
        <Stat label="Suất chưa xếp" value={shortfall} />
        <Stat label="Hồ sơ chờ duyệt" value={view.pendingRegistrations} tone={view.pendingRegistrations ? "warning" : "neutral"} />
      </StatGrid>
      <div className={ops.tabs} role="tablist" aria-label="Quản lý tình nguyện viên">
        <button type="button" role="tab" aria-selected={pane === "groups"} aria-pressed={pane === "groups"}
          className={pane === "groups" ? "primary" : "secondary"} onClick={() => setPane("groups")}>Nhóm và thành viên</button>
        <button type="button" role="tab" aria-selected={pane === "applications"} aria-pressed={pane === "applications"}
          className={pane === "applications" ? "primary" : "secondary"} onClick={() => setPane("applications")}>Duyệt hồ sơ
          <span>{view.pendingRegistrations}</span></button>
      </div>

      {pane === "groups" && <>
        <Legend items={[{ label: "Đã xác nhận", tone: "positive" }, { label: "Đã xếp, chờ xác nhận", tone: "info" },
          { label: "Còn trống", tone: "neutral" }]} />
        <div className={styles.groupLayout}>
        <div className={styles.groupList} aria-label="Các nhóm trong chiến dịch">
          {view.groups.map((group) => <button type="button" key={group.id}
            aria-pressed={selectedGroup === group.id} className={selectedGroup === group.id ? styles.groupCardActive : styles.groupCard}
            onClick={() => setSelectedGroup(group.id)}>
            <span className={styles.cardMeta}>{group.category} · {dateLabel(group.date)}</span>
            <strong>{group.name}</strong>
            <span className={styles.capacity}><b>{group.assignedCount}/{group.target}</b>
              {group.remaining ? <StatusPill tone="warning">Còn {group.remaining} suất</StatusPill> : <StatusPill tone="positive">Đã xếp đủ</StatusPill>}</span>
            <VolunteerCapacity target={group.target} assigned={group.assignedCount} confirmed={group.confirmedCount} />
            <span className={styles.cardMeta}>{group.confirmedCount} đã xác nhận</span>
            {(group.activityTitle || group.teamName) && <span className={styles.cardMeta}>
              {[group.activityTitle, group.teamName && `Đội ${group.teamName}`].filter(Boolean).join(" · ")}</span>}
          </button>)}
          {view.groups.length === 0 && <p className={ops.empty}>Chiến dịch chưa có nhóm nào đang tuyển.</p>}
        </div>
        <section className={styles.roster} aria-labelledby="group-roster-title">
          {selected ? <>
            <header><div><p className={styles.kicker}>DANH SÁCH THÀNH VIÊN</p>
              <h3 id="group-roster-title">{selected.name}</h3>
              <p>{selected.assignedCount} / {selected.target} đã xếp · {selected.confirmedCount} đã xác nhận</p>
              {(selected.activityTitle || selected.teamName) && <small>{[selected.activityTitle, selected.teamName && `Đội ${selected.teamName}`].filter(Boolean).join(" · ")}</small>}</div>
              <button type="button" className="secondary" onClick={() => setPane("applications")}>Duyệt đơn</button></header>
            <section className={styles.teamLeader} aria-label="Trưởng nhóm, không tính vào chỉ tiêu tình nguyện viên">
              <span className={styles.leaderAvatar} aria-hidden="true">★</span>
              <div><span className={styles.leaderLabel}>TRƯỞNG NHÓM · KHÔNG TÍNH VÀO CHỈ TIÊU</span>
                <strong>{selected.teamLeaderName || "Chưa phân công trưởng nhóm"}</strong>
                {selected.teamName && <small>{selected.teamName}</small>}</div>
            </section>
            {!members && <p role="status" className={ops.empty}>Đang tải thành viên…</p>}
            {!!members?.length && <div className={styles.memberList}>{members.map((member, index) => <article key={member.registrationId}>
              <span className={styles.avatar}>{member.fullName.trim().charAt(0).toUpperCase()}</span>
              <div><strong>{member.fullName}</strong><small>{member.email} · {member.phoneNumber}</small></div>
              <span className={styles.memberIndex}>{String(index + 1).padStart(2, "0")}</span>
            </article>)}</div>}
            {members?.length === 0 && <p className={ops.empty}>Chưa có tình nguyện viên nào được duyệt vào nhóm này.</p>}
          </> : <p className={ops.empty}>Chọn một nhóm để xem thành viên.</p>}
        </section>
        </div>
      </>}

      {pane === "applications" && <div className={styles.reviewLayout}>
        <section className={styles.applicationList} aria-label="Hồ sơ tình nguyện">
          <header><h3>Hồ sơ đăng ký</h3><label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="SUBMITTED">Mới gửi</option><option value="UNDER_REVIEW">Cần xem xét</option>
            <option value="WAITLISTED">Danh sách chờ</option><option value="APPROVED">Đã xếp nhóm</option>
          </select></label></header>
          {applications?.items.map((item) => <button type="button" key={item.id}
            aria-pressed={selectedRegistration === item.id} className={selectedRegistration === item.id ? styles.applicantActive : styles.applicant}
            onClick={() => setSelectedRegistration(item.id)}>
            <strong>{item.fullName}</strong><small>{item.email}</small>
            <span>{item.groupPreferences.length} nhóm quan tâm · {new Date(item.submittedAt).toLocaleDateString("vi-VN")}</span>
          </button>)}
          {applications && applications.items.length === 0 && <p className={ops.empty}>Không có hồ sơ ở trạng thái này.</p>}
          {!applications && !error && <p role="status" className={ops.empty}>Đang tải hồ sơ…</p>}
        </section>
        <section className={styles.reviewDetail} aria-label="Chi tiết xét duyệt">
          {detail ? <>
            <p className={styles.kicker}>HỒ SƠ TÌNH NGUYỆN</p><h3>{detail.fullName}</h3>
            {detail.reviewNote && <p className={styles.reviewNote}>{detail.reviewNote}</p>}
            <dl><div><dt>Email</dt><dd>{detail.email}</dd></div><div><dt>Điện thoại</dt><dd>{detail.phoneNumber}</dd></div>
              <div><dt>Ngày sinh</dt><dd>{detail.dateOfBirth || "—"}</dd></div><div><dt>Nghề nghiệp</dt><dd>{detail.occupation || "—"}</dd></div>
              <div><dt>Kỹ năng</dt><dd>{detail.skills || "—"}</dd></div><div><dt>Sức khỏe</dt><dd>{detail.healthNote || "—"}</dd></div>
              <div><dt>Kinh nghiệm</dt><dd>{detail.experience || "—"}</dd></div><div><dt>Động lực</dt><dd>{detail.motivation || "—"}</dd></div>
              <div><dt>Liên hệ khẩn cấp</dt><dd>{[detail.emergencyContactName, detail.emergencyContactPhone].filter(Boolean).join(" · ") || "—"}</dd></div>
            </dl>
            <fieldset disabled={busy} className={styles.assignFieldset}><legend>Phân công nhóm khi duyệt</legend>
              <p>Nguyện vọng đăng ký không tự động trở thành phân công chính thức.</p>
              {view.groups.map((group) => {
                const checked = assignedGroupIds.includes(group.id);
                const full = group.remaining === 0 && !checked;
                return <label key={group.id}><input type="checkbox" disabled={full} checked={checked}
                  onChange={(event) => setAssignedGroupIds((current) => event.target.checked
                    ? [...current, group.id] : current.filter((id) => id !== group.id))} />
                  <span>{group.name}</span><small>{detail.groupPreferences.some((item) => item.groupId === group.id) ? "Nguyện vọng · " : ""}{group.assignedCount}/{group.target}{full ? " · Đã đủ" : ""}</small>
                </label>;
              })}
              {view.groups.length === 0 && <p>Chưa có nhóm để phân công.</p>}
            </fieldset>
            <label className={styles.noteLabel}>Ghi chú / lý do từ chối<textarea rows={2} maxLength={2000}
              value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label>
            <div className={styles.reviewActions}>
              {detail.status !== "APPROVED" && <>
                <button type="button" className="secondary" disabled={busy} onClick={() => void review("WAITLIST")}>Đưa vào danh sách chờ</button>
                <button type="button" className={styles.rejectButton} disabled={busy} onClick={() => void review("REJECT")}>Từ chối</button>
              </>}
              <button type="button" disabled={busy} onClick={() => void review("APPROVE")}>{busy ? "Đang lưu…" : detail.status === "APPROVED" ? "Cập nhật nhóm" : "Duyệt và phân nhóm"}</button>
            </div>
          </> : <p className={ops.empty}>Chọn hồ sơ để xem chi tiết và xét duyệt.</p>}
        </section>
      </div>}
    </>}
  </section>;
}
