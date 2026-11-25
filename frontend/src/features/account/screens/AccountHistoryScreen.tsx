"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "@/features/account/Account.module.css";
import Protected from "@/features/auth/components/Protected";
import { api } from "@/shared/api/api";
import { ProcessSteps, Stat, StatGrid, StatusPill } from "@/shared/ui/StatusVisuals";
import { ActivityList, ActivityPager, historyTime, useActivityList } from "../components/AccountActivity";

type Offer = { id: string; groupId: string; status: string; confirmBy: string | null; confirmedAt: string | null };
type Registration = { id: string; campaignId: string; campaignTitle?: string; status: string; note: string | null; submittedAt: string; offers: Offer[] };
type Openings = {
  campaignTitle: string; location: string;
  groups: { id: string; name: string; date: string | null; dayId: string | null; activityId: string | null; teamName: string | null }[];
  days: { id: string; activities: { id: string; start: string | null; end: string | null; location: string }[] }[];
};
type Task = { assignmentId: string; campaignId: string; name: string; description: string; startTime: string | null;
  endTime: string | null; assignmentStatus: string; volunteerNote: string | null };

const statuses: Record<string, string> = {
  SUBMITTED: "Đã gửi", UNDER_REVIEW: "Cần xét duyệt", APPROVED: "Đã được xếp nhóm",
  WAITLISTED: "Danh sách chờ", REJECTED: "Từ chối", WITHDRAWN: "Đã rút",
  ASSIGNED: "Chờ phản hồi", ACCEPTED: "Đã nhận việc", IN_PROGRESS: "Đang thực hiện", DECLINED: "Đã báo vướng mắc", COMPLETED: "Đã hoàn thành", CANCELLED: "Đã hủy",
};
const endpoint = "/api/volunteers/me/registrations";
const registrationSteps = ["Gửi hồ sơ", "Xếp ca", "Xác nhận ca"];
const statusTone = (status: string) => ["APPROVED", "ACCEPTED", "COMPLETED"].includes(status) ? "positive" :
  ["UNDER_REVIEW", "WAITLISTED", "ASSIGNED", "DECLINED"].includes(status) ? "warning" : status === "REJECTED" ? "danger" : "neutral";

function History() {
  const list = useActivityList<Registration>(endpoint);
  const [selected, setSelected] = useState<Registration>();
  const [openings, setOpenings] = useState<Openings>();
  const [tasks, setTasks] = useState<Task[]>();
  const [taskError, setTaskError] = useState("");
  const [reporting, setReporting] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const campaignId = selected?.campaignId;
  const activeOffers = selected?.offers.filter((offer) => offer.status === "OFFERED" || offer.status === "CONFIRMED") ?? [];
  const allConfirmed = activeOffers.length > 0 && activeOffers.every((offer) => offer.status === "CONFIRMED");

  useEffect(() => {
    const controller = new AbortController();
    const id = new URLSearchParams(window.location.search).get("registration");
    if (id) api<Registration>(endpoint + "/" + encodeURIComponent(id), { signal: controller.signal })
      .then(setSelected).catch((reason: Error) => { if (!controller.signal.aborted) setDetailError(reason.message); });
    api<Task[]>("/api/volunteers/me/tasks", { signal: controller.signal })
      .then(setTasks).catch((reason: Error) => { if (!controller.signal.aborted) setTaskError(reason.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setOpenings(undefined);
    if (!campaignId) return;
    const controller = new AbortController();
    api<Openings>(`/api/campaigns/${campaignId}/volunteer-openings`, { signal: controller.signal })
      .then(setOpenings).catch(() => {});
    return () => controller.abort();
  }, [campaignId]);

  async function respond(path: string, accept?: boolean) {
    if (!selected || busy) return;
    if (accept !== true && !window.confirm(accept === false ? "Bạn muốn nhường suất này?" : "Bạn muốn rút hồ sơ và nhường các suất đã xếp?")) return;
    setBusy(true);
    setDetailError("");
    const detailPath = endpoint + "/" + selected.id;
    try {
      setSelected(await api<Registration>(detailPath + path, {
        method: "POST", body: accept === undefined ? undefined : JSON.stringify({ accept }),
      }));
      list.reload();
    } catch (reason) {
      setDetailError((reason as Error).message);
      try { setSelected(await api<Registration>(detailPath)); list.reload(); } catch { /* Keep the server message. */ }
    } finally { setBusy(false); }
  }

  async function replyToTask(id: string, accept: boolean, note?: string) {
    if (taskBusy) return;
    setTaskBusy(true);
    setTaskError("");
    try {
      const updated = await api<Task>(`/api/volunteers/me/tasks/${id}/response`, {
        method: "POST", body: JSON.stringify({ accept, note }),
      });
      setTasks((current) => current?.map((task) => task.assignmentId === id ? updated : task));
      setReporting("");
    } catch (reason) { setTaskError((reason as Error).message); }
    finally { setTaskBusy(false); }
  }

  return <div className={styles.accountSubpage}>
    <header className={`${styles.accountPageHeading} ${styles.activityHero}`}><h1>Lịch sử tham gia</h1>
      <p>Hồ sơ, ca tình nguyện và nhiệm vụ của bạn.</p></header>
    {!!tasks?.length && <div className={styles.activityMetrics}><StatGrid label="Nhiệm vụ tình nguyện">
      <Stat label="Nhiệm vụ được giao" value={tasks.length} tone="info" />
      <Stat label="Chờ phản hồi" value={tasks.filter((task) => task.assignmentStatus === "ASSIGNED").length} tone="warning" />
      <Stat label="Đã hoàn thành" value={tasks.filter((task) => task.assignmentStatus === "COMPLETED").length} tone="positive" />
    </StatGrid></div>}
    <ActivityList title="Hồ sơ tình nguyện">
      {list.error && <p role="alert">{list.error} <button onClick={list.reload}>Tải lại</button></p>}
      {list.loading ? <p role="status">Đang tải hồ sơ…</p> : !list.error && list.rows.length === 0 &&
        <p>Chưa có hồ sơ trên trang này. <Link href="/chien-dich">Xem chiến dịch</Link></p>}
      {list.rows.map((row) => <div key={row.id} data-active={selected?.id === row.id}>
        {row.campaignTitle && <strong>{row.campaignTitle}</strong>}
        <StatusPill tone={statusTone(row.status)}>{statuses[row.status] ?? row.status}</StatusPill>
        <span>Gửi lúc {historyTime(row.submittedAt)}</span>
        <button type="button" aria-expanded={selected?.id === row.id} aria-controls="registration-detail" disabled={busy}
          onClick={() => { setDetailError(""); setSelected(row); }}>Xem hồ sơ</button>
      </div>)}
      <ActivityPager page={list.page} next={list.rows.length === 20} disabled={list.loading || busy} onChange={list.setPage} />
    </ActivityList>
    {detailError && <p role="alert">{detailError}</p>}
    {selected && <ActivityList id="registration-detail" title={openings?.campaignTitle ?? (selected.campaignTitle || "Chi tiết hồ sơ")}>
      <p><StatusPill tone={statusTone(selected.status)}>{statuses[selected.status] ?? selected.status}</StatusPill> · Gửi lúc {historyTime(selected.submittedAt)}</p>
      {["SUBMITTED", "UNDER_REVIEW", "WAITLISTED", "APPROVED"].includes(selected.status) &&
        <ProcessSteps labels={registrationSteps} current={activeOffers.length > 0 ? 2 : 1} finished={allConfirmed} />}
      {selected.note && <p>{selected.note}</p>}
      <p><Link href={`/chien-dich/${selected.campaignId}`}>Mở trang chiến dịch</Link></p>
      {selected.offers.map((offer) => {
        const group = openings?.groups.find((item) => item.id === offer.groupId);
        const slot = openings?.days.find((day) => day.id === group?.dayId)?.activities.find((item) => item.id === group?.activityId);
        const active = offer.status === "OFFERED" || offer.status === "CONFIRMED";
        return <div key={offer.id}><strong>{group?.name ?? "Ca tình nguyện"}</strong>
          <span>{[group?.date, slot?.start?.slice(0, 5), slot?.end?.slice(0, 5), slot?.location || openings?.location, group?.teamName].filter(Boolean).join(" · ")}</span>
          <StatusPill tone={offer.confirmedAt && active ? "positive" : active ? "warning" : "neutral"}>
            {!active ? offer.status === "EXPIRED" ? "Đã hết hạn xác nhận" : "Suất đã kết thúc" : offer.confirmedAt ? `Đã xác nhận lúc ${historyTime(offer.confirmedAt)}`
              : offer.confirmBy ? `Hạn xác nhận ${historyTime(offer.confirmBy)}` : "Chờ xác nhận"}
          </StatusPill>
          {active && selected.status === "APPROVED" && !offer.confirmedAt && <button disabled={busy} onClick={() => void respond(`/offers/${offer.id}`, true)}>Xác nhận ca</button>}
          {active && selected.status === "APPROVED" && <button disabled={busy} onClick={() => void respond(`/offers/${offer.id}`, false)}>Nhường ca</button>}
        </div>;
      })}
      {["SUBMITTED", "UNDER_REVIEW", "WAITLISTED", "APPROVED"].includes(selected.status) &&
        <p><button disabled={busy} onClick={() => void respond("/withdraw")}>Rút hồ sơ</button></p>}
    </ActivityList>}
    <ActivityList title="Nhiệm vụ được giao">
      {taskError ? <p role="alert">{taskError}</p> : !tasks ? <p role="status">Đang tải nhiệm vụ…</p> : !tasks.length && <p>Bạn chưa có nhiệm vụ được giao.</p>}
      {tasks?.map((task) => <div key={task.assignmentId}><strong>{task.name}</strong>
        <StatusPill tone={statusTone(task.assignmentStatus)}>{statuses[task.assignmentStatus] ?? task.assignmentStatus}</StatusPill>
        {task.description && <span>{task.description}</span>}
        {task.startTime && <span>{task.startTime.slice(0, 5)}{task.endTime && " – " + task.endTime.slice(0, 5)}</span>}
        {task.volunteerNote && <span>{task.volunteerNote}</span>}
        {task.assignmentStatus === "ASSIGNED" && <button disabled={taskBusy} onClick={() => void replyToTask(task.assignmentId, true)}>Nhận việc</button>}
        {["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(task.assignmentStatus) && <button disabled={taskBusy}
          onClick={() => setReporting(reporting === task.assignmentId ? "" : task.assignmentId)}>Báo vướng mắc</button>}
        {reporting === task.assignmentId && <form onSubmit={(event) => {
          event.preventDefault();
          void replyToTask(task.assignmentId, false, String(new FormData(event.currentTarget).get("note")));
        }}><label>Vướng mắc <input name="note" required maxLength={1000} /></label><button disabled={taskBusy}>Gửi trưởng đội</button></form>}
        <Link href={`/chien-dich/${task.campaignId}`}>Mở chiến dịch</Link>
      </div>)}
    </ActivityList>
  </div>;
}

export default function AccountHistoryScreen() {
  return <Protected><History /></Protected>;
}
