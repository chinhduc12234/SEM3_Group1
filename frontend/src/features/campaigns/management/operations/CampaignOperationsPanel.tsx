import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api/api";
import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "../CampaignManagement.module.css";
import CampaignOperationsSummary from "./CampaignOperationsSummary";
import CampaignRouteMap from "../../components/itinerary/CampaignRouteMap";
import type { Campaign } from "../../types/campaigns";
import { operationsRouteStops } from "./operationsRouteStops";
import ops from "./OperationsDashboard.module.css";
import { OperationsMetrics } from "./OperationsDashboard";
import OperationsStatusBadge from "./OperationsStatusBadge";
import { useActivityPhotoReports } from "./ActivityPhotoReports";
import AttendanceForm from "./AttendanceForm";
import OperationsDays from "./OperationsDays";
import OperationsActivities from "./OperationsActivities";
import OperationsTeams from "./OperationsTeams";
import OperationsVolunteerGroups from "./OperationsVolunteerGroups";
import { dayLabel, replace } from "./OperationsFields";
import type { Attendance, Day, OperationsTab, OperationsView, Plan } from "./operationsTypes";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useLocale } from "@/shared/i18n/LocaleProvider";

export default function CampaignOperationsPanel({ campaign, groupsOnly = false }: { campaign: Campaign; groupsOnly?: boolean }) {
  const { t } = useLocale();
  const { id: campaignId, startDate, endDate } = campaign;
  const [view, setView] = useState<OperationsView>();
  const [plan, setPlan] = useState<Plan>();
  const [operationsTab, setTab] = useState<OperationsTab>(campaign.status === "PUBLISHED" ? "attendance" : "days");
  const tab = groupsOnly ? "volunteerGroups" : operationsTab;
  const [dayId, setDayId] = useState("");
  const [pinDayId, setPinDayId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusSummary = useRef(false);
  const endpoint = `/api/campaigns/${campaignId}/operations`;
  const photoReports = useActivityPhotoReports(campaignId, !groupsOnly);
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
      focusSummary.current = confirm && !groupsOnly;
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

  return <LocalizedTree><section className={ops.surface} aria-labelledby="operations-title">
    <header className={ops.panelHeader}>
      <div><h2 id="operations-title">{groupsOnly ? "Cấu hình nhóm tình nguyện" : "Kế hoạch vận hành"}</h2>
        {startDate && endDate && <p className="muted">{formatCampaignDate(startDate)} – {formatCampaignDate(endDate)}</p>}
      </div>
      <div className={ops.actions}>
        {view && <OperationsStatusBadge confirmedAt={view.confirmedAt} />}
        {campaign.status === "PLANNING" && <Link
          className={ops.listLink}
          href={`/organizations/${campaign.organizationId}/manage/${groupsOnly ? "operations" : "volunteers"}/${campaignId}`}
          aria-disabled={busy}
          onNavigate={(event) => {
            if (busy || (view && plan !== view.plan && !window.confirm(t("Bạn có thay đổi chưa lưu. Rời trang này?"))))
              event.preventDefault();
          }}
        >{groupsOnly ? "Mở kế hoạch vận hành" : "Cấu hình nhóm tình nguyện"}</Link>}
      </div>
    </header>
    {error && <p className="notice error" role="alert">{error} <button type="button" className="quiet"
      disabled={busy} onClick={() => setRetry(retry + 1)}>Tải lại kế hoạch</button></p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {!view && !error && <p role="status">Đang tải kế hoạch…</p>}
    {view && plan && <>
      {!groupsOnly && <><OperationsMetrics items={[
        ["Ngày triển khai", plan.days.length], ["Hoạt động", activities.length],
        ["Đội phụ trách", plan.teams.length], ["Nhóm tình nguyện", plan.volunteerGroups.length],
      ]} />
      {confirmed && <div ref={summaryRef} tabIndex={-1}>
        <CampaignOperationsSummary view={view} />
        {plan !== view.plan && <p className="muted">Có thay đổi chưa lưu. Bản tổng quan đang hiển thị kế hoạch đã xác nhận.</p>}
      </div>}
      <div className={ops.tabs} role="group" aria-label="Các phần kế hoạch vận hành">
        {([["days", "Ngày triển khai", plan.days.length], ["activities", "Hoạt động theo ngày", activities.length],
          ["teams", "Đội và nhân sự", plan.teams.length],
          ["route", "Bản đồ triển khai", plan.days.length], ["attendance", "Ghi nhận quân số", activities.length]] as const)
          .filter(([key]) => key === "route" || (key === "attendance" ? view.canRecordAttendance :
            view.canEdit || (key === "activities" && view.canRecordAttendance)))
          .map(([key, label, count]) =>
          <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? "primary" : "secondary"}
            onClick={() => setTab(key)}>{label} <span>{count}</span></button>
        )}
      </div></>}
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
        {tab === "days" && <OperationsDays plan={plan} view={view} selectedDay={selectedDay} campaign={campaign} pinDayId={pinDayId}
          setPinDayId={setPinDayId} setDayId={setDayId} isOutside={isOutside} edit={edit} removeDay={removeDay} busy={busy} />}
        {tab === "activities" && <OperationsActivities selectedDay={selectedDay} plan={plan} view={view} teams={teams}
          campaignId={campaignId} photoReports={photoReports} edit={edit} save={save} />}
        {tab === "teams" && <OperationsTeams plan={plan} view={view} edit={edit} />}
        {tab === "volunteerGroups" && <OperationsVolunteerGroups plan={plan} view={view} activities={activities} teams={teams} edit={edit} />}
        {view.canEdit && <div className={ops.saveBar}>
          <p>{busy ? "Đang lưu…" : plan !== view.plan ? "Có thay đổi chưa lưu" : "Đã đồng bộ kế hoạch"}</p>
          <div className={ops.actions}>
            <button type="button" className="secondary" onClick={() => void save(false)}>Lưu bản nháp vận hành</button>
            <button type="button" onClick={() => void save(true)}>Gửi xác nhận kế hoạch vận hành</button>
          </div>
        </div>}
      </fieldset>
    </>}
  </section></LocalizedTree>;
}
