import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api/api";
import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "../CampaignManagement.module.css";
import CampaignOperationsSummary from "./CampaignOperationsSummary";
import CampaignAddressFields from "./CampaignAddressFields";
import CampaignRouteMap, { type RouteStop } from "../../components/CampaignRouteMap";
import type { Campaign, PlannedCampaignAddress } from "../../types/campaigns";
import { formatPlannedAddress } from "../campaignConceptFields";
import { operationsRouteStops } from "./operationsRouteStops";
import ops from "./OperationsDashboard.module.css";
import { OperationsMetrics } from "./OperationsDashboard";
import OperationsStatusBadge from "./OperationsStatusBadge";
import { ActivityPhotoSection, useActivityPhotoReports } from "./ActivityPhotoReports";

type Member = { userId: string; fullName: string };
type Attendance = { staffConfirmed: number; staffPresent: number; volunteersConfirmed: number; volunteersPresent: number };
const emptyAttendance: Attendance = { staffConfirmed: 0, staffPresent: 0, volunteersConfirmed: 0, volunteersPresent: 0 };
const emptyAddress: PlannedCampaignAddress = { mode: "CURRENT", province: null, district: null, ward: null, detail: "" };
type Activity = {
  id: string; title: string; start: string | null; end: string | null; location: string;
  tasks: string; leadUserId: string | null; staffNeeded: number; volunteersNeeded: number; teamIds: string[];
  backupUserId?: string | null; attendance?: Attendance | null;
};
type Day = {
  id: string; date: string | null; title: string; objective: string; description: string;
  location: string; leadUserId: string | null; notes: string; activities: Activity[];
  activitiesDone?: boolean; extraReason?: string | null; extraApprovedAt?: string | null;
  address?: PlannedCampaignAddress | null; mapPin?: RouteStop["pin"];
};
type Team = {
  id: string; name: string; duties: string; leadUserId: string | null; staffNeeded: number;
  volunteersNeeded: number; volunteerSkills: string; staffUserIds: string[];
};
type VolunteerGroup = {
  id: string; name: string; categoryId: string; volunteerCount: number;
  dayId: string | null; activityId: string | null; teamId: string | null; notes: string;
};
type Plan = { days: Day[]; teams: Team[]; resources: unknown[]; volunteerGroups: VolunteerGroup[] };
export type OperationsView = {
  version: string; plan: Plan; confirmedAt: string | null; canEdit: boolean; members: Member[];
  confirmedByName: string | null;
  canRecordAttendance: boolean;
  canApproveExtraDays: boolean; hasAutomaticCalendar: boolean;
  volunteerGroupCategories: { id: string; name: string }[];
};
type OperationsTab = "days" | "activities" | "teams" | "volunteerGroups" | "route" | "attendance";

function dayLabel(day: Day, index: number) {
  return [day.date && formatCampaignDate(day.date), day.title || `Ngày ${index + 1}`, day.activitiesDone && "Đã xong"]
    .filter(Boolean).join(" · ");
}

function field(label: string, value: string | null, change: (value: string) => void,
  type: "text" | "textarea" | "date" | "time" = "text") {
  return <label>{label}
    {type === "textarea" ? <textarea rows={2} value={value ?? ""} onChange={(e) => change(e.target.value)} /> :
      <input type={type} value={type === "time" ? value?.slice(0, 5) ?? "" : value ?? ""} onChange={(e) => change(e.target.value)} />}
  </label>;
}

function quantity(label: string, value: number, change: (value: number) => void) {
  return <label>{label}<input type="number" min={0} max={100000}
    step={1} value={value} onChange={(e) => change(e.target.valueAsNumber || 0)} /></label>;
}

function person(label: string, members: Member[], value: string | null, change: (value: string | null) => void) {
  return <label>{label}<select value={value ?? ""} onChange={(e) => change(e.target.value || null)}>
    <option value="">Chưa chọn</option>
    {value && !members.some((member) => member.userId === value) && <option value={value}>Nhân sự không còn hoạt động</option>}
    {members.map(({ userId, fullName }) => <option key={userId} value={userId}>{fullName}</option>)}
  </select></label>;
}

function Checklist({ label, options, values, change }: {
  label: string; options: { id: string; name: string }[]; values: string[]; change: (values: string[]) => void;
}) {
  const unavailable = values.filter((id) => !options.some((option) => option.id === id));
  return <details className={styles.operationsChoices}>
    <summary>{label} ({values.length})</summary>
    {options.length === 0 && unavailable.length === 0 && <p className="muted">Chưa có lựa chọn.</p>}
    {[...options, ...unavailable.map((id) => ({ id, name: "Nhân sự không còn hoạt động" }))].map(({ id, name }) =>
      <label key={id}><input type="checkbox" checked={values.includes(id)}
        onChange={(e) => change(e.target.checked ? [...values, id] : values.filter((value) => value !== id))} /> {name}</label>
    )}
  </details>;
}

function replace<T extends { id: string }>(items: T[], id: string, updates: Partial<T>) {
  return items.map((item) => item.id === id ? { ...item, ...updates } : item);
}

function AttendanceForm({ activity, disabled, onSave }: { activity: Activity; disabled: boolean; onSave: (counts: Attendance) => void }) {
  const [counts, setCounts] = useState(activity.attendance ?? emptyAttendance);
  return <div className={styles.operationsItem}>
    <h6>Ghi nhận quân số</h6>
    <p>Kế hoạch: {activity.staffNeeded} nhân sự · {activity.volunteersNeeded} tình nguyện viên.</p>
    <div className={styles.operationsFields}>
      {([
        ["staffConfirmed", "Nhân sự đã xác nhận"], ["staffPresent", "Nhân sự có mặt"],
        ["volunteersConfirmed", "Tình nguyện viên đã xác nhận"], ["volunteersPresent", "Tình nguyện viên có mặt"],
      ] as const).map(([key, label]) => <div key={key}>{quantity(label, counts[key],
        (value) => setCounts((current) => ({ ...current, [key]: value })))}</div>)}
    </div>
    <button type="button" className="secondary" disabled={disabled} onClick={() => onSave(counts)}>Lưu quân số</button>
    {disabled && <p className="muted">Lưu thay đổi của kế hoạch trước khi cập nhật quân số.</p>}
  </div>;
}

export default function CampaignOperationsPanel({ campaign }: { campaign: Campaign }) {
  const { id: campaignId, startDate, endDate } = campaign;
  const [view, setView] = useState<OperationsView>();
  const [plan, setPlan] = useState<Plan>();
  const [tab, setTab] = useState<OperationsTab>(campaign.status === "PUBLISHED" ? "attendance" : "days");
  const [dayId, setDayId] = useState("");
  const [pinDayId, setPinDayId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusSummary = useRef(false);
  const endpoint = `/api/campaigns/${campaignId}/operations`;
  const photoReports = useActivityPhotoReports(campaignId);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setMessage("");
    api<OperationsView>(endpoint, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setView(result);
      setPlan(result.plan);
    }).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [endpoint, retry]);
  useEffect(() => {
    if (view?.confirmedAt && focusSummary.current) {
      focusSummary.current = false;
      summaryRef.current?.focus();
    }
  }, [view?.confirmedAt]);

  function edit(change: (current: Plan) => Plan) {
    setPlan((current) => current && change(current));
    setMessage("");
  }

  async function save(confirm: boolean, finishedDay?: Day) {
    if (!view?.canEdit || !plan || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<OperationsView>(endpoint, {
        method: "PUT",
        body: JSON.stringify({ version: view.version, plan: finishedDay
          ? { ...plan, days: replace(plan.days, finishedDay.id, { activitiesDone: true }) } : plan, confirm }),
      });
      focusSummary.current = confirm;
      setView(result);
      setPlan(result.plan);
      if (finishedDay) {
        const days = result.plan.days;
        const index = days.findIndex((day) => day.id === finishedDay.id);
        const next = [...days.slice(index + 1), ...days.slice(0, index)].find((day) => !day.activitiesDone);
        setDayId(next?.id ?? finishedDay.id);
      }
      setMessage(confirm ? "Đã xác nhận kế hoạch vận hành." : finishedDay
        ? "Đã lưu hoạt động của ngày." : "Đã lưu bản nháp vận hành.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAttendance(activityId: string, attendance: Attendance) {
    if (!view?.canRecordAttendance || plan !== view.plan || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<OperationsView>(`${endpoint}/activities/${activityId}/attendance`, {
        method: "PUT", body: JSON.stringify({ version: view.version, attendance }),
      });
      setView(result);
      setPlan(result.plan);
      setMessage("Đã lưu quân số hoạt động.");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function isOutside(date: string | null) {
    return !!date && ((!!startDate && date < startDate) || (!!endDate && date > endDate));
  }

  function removeDay(day: Day) {
    edit((p) => ({
      ...p, days: p.days.filter((item) => item.id !== day.id), volunteerGroups: p.volunteerGroups.map((r) =>
        r.dayId === day.id || day.activities.some((a) => a.id === r.activityId) ? { ...r, dayId: null, activityId: null } : r),
    }));
  }

  const confirmed = view?.confirmedAt;
  const selectedDay = plan?.days.find((day) => day.id === dayId) ?? plan?.days[0];
  const activities = plan?.days.flatMap((day) => day.activities.map((activity) => ({ day, activity }))) ?? [];
  const teams = plan?.teams.map((team) => ({ id: team.id, name: team.name || "Đội chưa đặt tên" })) ?? [];

  return <section className={ops.surface} aria-labelledby="operations-title">
    <header className={ops.panelHeader}>
      <div><h2 id="operations-title">Kế hoạch vận hành</h2>
        {startDate && endDate && <p className="muted">{formatCampaignDate(startDate)} – {formatCampaignDate(endDate)}</p>}
      </div>
      {view && <OperationsStatusBadge confirmedAt={view.confirmedAt} />}
    </header>
    {error && <p className="notice error" role="alert">{error} <button type="button" className="quiet"
      disabled={busy} onClick={() => setRetry(retry + 1)}>Tải lại kế hoạch</button></p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {!view && !error && <p role="status">Đang tải kế hoạch…</p>}
    {view && plan && <>
      <OperationsMetrics items={[
        ["Ngày triển khai", plan.days.length], ["Hoạt động", activities.length],
        ["Đội phụ trách", plan.teams.length], ["Nhóm tình nguyện", plan.volunteerGroups.length],
      ]} />
      {confirmed && <div ref={summaryRef} tabIndex={-1}>
        <CampaignOperationsSummary view={view} />
        {plan !== view.plan && <p className="muted">Có thay đổi chưa lưu. Bản tổng quan đang hiển thị kế hoạch đã xác nhận.</p>}
      </div>}
      <div className={ops.tabs} role="group" aria-label="Các phần kế hoạch vận hành">
        {([["days", "Ngày triển khai", plan.days.length], ["activities", "Hoạt động theo ngày", activities.length],
          ["teams", "Đội và nhân sự", plan.teams.length], ["volunteerGroups", "Nhóm tình nguyện", plan.volunteerGroups.length],
          ["route", "Bản đồ triển khai", plan.days.length], ["attendance", "Ghi nhận quân số", activities.length]] as const)
          .filter(([key]) => key === "route" || (key === "attendance" ? view.canRecordAttendance :
            view.canEdit || (key === "activities" && view.canRecordAttendance)))
          .map(([key, label, count]) =>
          <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? "primary" : "secondary"}
            onClick={() => setTab(key)}>{label} <span>{count}</span></button>
        )}
      </div>
      {tab === "route" && <CampaignRouteMap stops={operationsRouteStops(plan.days, campaign)} province="" />}
      {(tab === "days" || tab === "activities" || tab === "attendance") && selectedDay && (
        <label className={ops.dayPicker}>Chọn ngày
          <select value={selectedDay.id} disabled={busy} onChange={(e) => setDayId(e.target.value)}>
            {plan.days.map((day, index) => <option key={day.id} value={day.id}>{dayLabel(day, index)}</option>)}
          </select>
        </label>
      )}
      {tab === "attendance" && view.canRecordAttendance && selectedDay && <fieldset disabled={busy} className={styles.conceptForm}>
        {!selectedDay.activities.length && <p>Ngày này chưa có hoạt động.</p>}
        {selectedDay.activities.map((activity) => <section className={styles.operationsItem} key={activity.id}>
          <h4>{activity.title}</h4>
          <AttendanceForm key={JSON.stringify(activity.attendance ?? null)} activity={activity}
            disabled={plan !== view.plan} onSave={(counts) => void saveAttendance(activity.id, counts)} />
        </section>)}
      </fieldset>}
      {selectedDay && isOutside(selectedDay.date) && (tab === "days" || tab === "activities") && (
        <div className={styles.operationsItem}>
          <strong>{selectedDay.extraApprovedAt ? "Ngày bổ sung đã được Owner duyệt" : "Ngày bổ sung ngoài khoảng đã duyệt"}</strong>
          {!selectedDay.extraApprovedAt && <p className="muted">Cần Owner duyệt trước khi xác nhận kế hoạch.</p>}
        </div>
      )}
      <fieldset className={styles.conceptForm} disabled={busy || (!view.canEdit && tab !== "activities")}>
        {tab === "days" && <>
          {plan.days.length === 0 && <p>Chưa có ngày triển khai.</p>}
          {startDate && endDate && !view.hasAutomaticCalendar &&
            <p className="muted">Khoảng đã duyệt dài hơn 366 ngày. Hãy thêm những ngày thực tế cần lên lịch.</p>}
          {selectedDay && (() => {
            const day = selectedDay;
            const calendarDay = view.hasAutomaticCalendar && !!day.date && !isOutside(day.date);
            function update(values: Partial<Day>) {
              edit((p) => ({ ...p, days: replace(p.days, day.id, values) }));
            }
            return <div className={styles.operationsItem} key={day.id}>
              <div className={styles.operationsFields}>
                {calendarDay
                  ? <label>Ngày thực hiện<input type="date" value={day.date ?? ""} readOnly /></label>
                  : field("Ngày thực hiện", day.date, (date) => update({ date: date || null, extraApprovedAt: null, activitiesDone: false }), "date")}
                {field("Tên ngày hoặc giai đoạn", day.title, (title) => update({ title }))}
                {field("Mục tiêu trong ngày", day.objective, (objective) => update({ objective }))}
                {!day.address && (day.location !== campaign.location || !campaign.concept?.plannedAddress) &&
                  field("Địa điểm chính", day.location, (location) => update({ location, mapPin: null }))}
                {person("Người phụ trách ngày", view.members, day.leadUserId, (leadUserId) => update({ leadUserId }))}
                {field("Mô tả", day.description, (description) => update({ description }), "textarea")}
                {field("Ghi chú đặc biệt", day.notes, (notes) => update({ notes }), "textarea")}
                {isOutside(day.date) && field("Lý do bổ sung ngày", day.extraReason ?? "", (extraReason) =>
                  update({ extraReason, extraApprovedAt: null }), "textarea")}
              </div>
              {campaign.concept?.eventFormat !== "ONLINE" && <>
                <CampaignAddressFields address={day.address ?? (day.location === campaign.location ? campaign.concept?.plannedAddress : null) ?? emptyAddress}
                  previousLocation={!day.address ? day.location : ""} legend="Địa chỉ ngày triển khai"
                  detailLabel="Địa chỉ cụ thể ngày triển khai" onChange={(address) =>
                    update({ address, location: formatPlannedAddress(address), mapPin: null })} />
                <div className="actions">
                  <button type="button" className="secondary" onClick={() => setPinDayId(pinDayId === day.id ? undefined : day.id)}>
                    {pinDayId === day.id ? "Đóng bản đồ đặt ghim" : "Đặt ghim trên bản đồ"}
                  </button>
                  {day.mapPin && <button type="button" className="quiet" onClick={() => update({ mapPin: null })}>Xóa ghim</button>}
                </div>
                {pinDayId === day.id && <CampaignRouteMap stops={operationsRouteStops([day], campaign)} province=""
                  onPick={(mapPin) => { if (view.canEdit && !busy) update({ mapPin }); }} />}
              </>}
              {view.canEdit && !calendarDay && <button type="button" className="quiet" onClick={() => removeDay(day)}>Bỏ ngày</button>}
            </div>;
          })()}
          {view.canEdit && <button type="button" className="secondary" onClick={() => {
            const id = crypto.randomUUID();
            setDayId(id);
            edit((p) => ({
              ...p, days: [...p.days, { id, date: p.days.length ? null : startDate,
                title: "", objective: "", description: "", location: campaign.location, address: campaign.concept?.plannedAddress,
                leadUserId: null, notes: "", activities: [] }],
            }));
          }}>Thêm ngày triển khai</button>}
        </>}
        {tab === "activities" && <>
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
        </>}
        {tab === "teams" && <>
          {plan.teams.length === 0 && <p>Chưa có đội.</p>}
          {plan.teams.map((team, index) => {
            function update(values: Partial<Team>) {
              edit((p) => ({ ...p, teams: replace(p.teams, team.id, values) }));
            }
            return <div className={styles.operationsItem} key={team.id}>
              <h4>{team.name || `Đội ${index + 1}`}</h4>
              <div className={styles.operationsFields}>
                {field("Tên đội", team.name, (name) => update({ name }))}
                {person("Trưởng đội", view.members, team.leadUserId, (leadUserId) =>
                  update({ leadUserId, staffUserIds: team.staffUserIds.filter((id) => id !== leadUserId) }))}
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
        </>}
        {tab === "volunteerGroups" && <>
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
        </>}
        {view.canEdit && <div className={ops.saveBar}>
          <p>{busy ? "Đang lưu…" : plan !== view.plan ? "Có thay đổi chưa lưu" : "Đã đồng bộ kế hoạch"}</p>
          <div className={ops.actions}>
            <button type="button" className="secondary" onClick={() => void save(false)}>Lưu bản nháp vận hành</button>
            <button type="button" onClick={() => void save(true)}>Gửi xác nhận kế hoạch vận hành</button>
          </div>
        </div>}
      </fieldset>
    </>}
  </section>;
}
