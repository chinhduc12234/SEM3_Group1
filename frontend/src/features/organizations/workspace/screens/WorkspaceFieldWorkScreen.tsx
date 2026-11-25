"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/shared/api/api";
import type { PageResult } from "@/shared/api/pagination";
import InKindReceiptForm from "@/features/campaigns/management/budget/InKindReceiptForm";
import { ProgressTrack, Stat, StatGrid, StatusPill } from "@/shared/ui/StatusVisuals";
import styles from "../Workspace.module.css";

type Group = { id: string; name: string; target: number };
type Shift = { date: string; activityId: string; activity: string; start: string; end: string; location: string; team: string; groups: Group[] };
type Program = { id: string; title: string; shifts: Shift[]; canReceiveGoods: boolean };
type ReceiptTarget = { budgetItemId: string; name: string; unit: string };
type Candidate = { registrationId: string; fullName: string };
type Task = { id: string; name: string; description: string; status: string; requiredVolunteers: number; assignedVolunteers: number;
  assignments: { id: string; registrationId: string; volunteerName: string; status: string; volunteerNote: string | null }[] };
type Selection = { program: Program; shift: Shift; group: Group };
const statusLabels: Record<string, string> = {
  OPEN: "Đang giao", ASSIGNED: "Chờ phản hồi", ACCEPTED: "Đã nhận việc", IN_PROGRESS: "Đang thực hiện", DECLINED: "Có vướng mắc", CANCELLED: "Đã hủy", COMPLETED: "Hoàn tất",
};
const taskTone = (status: string) => ["ACCEPTED", "COMPLETED"].includes(status) ? "positive" :
  status === "DECLINED" ? "danger" : status === "ASSIGNED" ? "warning" : status === "CANCELLED" ? "neutral" : "info";

function AssignedIntake({ campaignId }: { campaignId: string }) {
  const [targets, setTargets] = useState<ReceiptTarget[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<{ inKindTargets: ReceiptTarget[] }>(`/api/donations/campaigns/${campaignId}/summary`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setTargets(result.inKindTargets); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [campaignId]);
  if (error) return <p role="alert">{error}</p>;
  return targets ? <InKindReceiptForm campaignId={campaignId} targets={targets} onReceived={() => {}} allowReversal={false} />
    : <p role="status">Đang tải điểm nhận…</p>;
}

function TeamTasks({ program, shift, group }: Selection) {
  const [tasks, setTasks] = useState<Task[]>();
  const [candidates, setCandidates] = useState<Candidate[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const endpoint = `/api/volunteers/campaigns/${program.id}/activities/${shift.activityId}/groups/${group.id}`;

  useEffect(() => {
    const controller = new AbortController();
    setTasks(undefined);
    setCandidates(undefined);
    const signal = controller.signal;
    Promise.all([api<Task[]>(endpoint + "/tasks", { signal }), api<Candidate[]>(endpoint + "/task-candidates", { signal })])
      .then(([currentTasks, people]) => { if (!signal.aborted) { setTasks(currentTasks); setCandidates(people); } })
      .catch((reason: Error) => { if (!signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [endpoint, revision]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/volunteers/tasks", { method: "POST", body: JSON.stringify({
        campaignId: program.id, activityId: shift.activityId, groupId: group.id,
        name: values.get("name"), description: values.get("description"),
        requiredVolunteers: Number(values.get("required")), priority: "MEDIUM",
      }) });
      form.reset();
      setRevision((value) => value + 1);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function assign(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    if (busy) return;
    const ids = new FormData(event.currentTarget).getAll("registration");
    if (!ids.length) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<Task>(`/api/volunteers/tasks/${task.id}/assignments`, {
        method: "POST", body: JSON.stringify({ registrationIds: ids }),
      });
      setTasks((rows) => rows?.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <section id="selected-field-tasks" className={styles.ownerPanel}>
    <h2>Nhiệm vụ · {group.name}</h2>
    <p>{shift.activity} · {shift.date}</p>
    {error && <p className="notice error" role="alert">{error} <button onClick={() => { setError(""); setRevision((value) => value + 1); }}>Tải lại</button></p>}
    {!tasks ? !error && <p role="status">Đang tải nhiệm vụ…</p> : <>
      {!tasks.length && <p>Chưa có nhiệm vụ.</p>}
      {tasks.map((task) => {
        const available = candidates?.filter((person) => !task.assignments.some((item) =>
          item.registrationId === person.registrationId && !["CANCELLED", "DECLINED"].includes(item.status))) ?? [];
        const received = task.assignments.filter((item) => ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(item.status)).length;
        return <article className={styles.workCard} key={task.id}>
          <div className={styles.workCardMeta}><h3>{task.name}</h3><StatusPill tone={taskTone(task.status)}>{statusLabels[task.status] ?? task.status}</StatusPill></div>
          <p>{task.description}</p>
          <ProgressTrack limit={task.requiredVolunteers} segments={[
            { value: received, tone: "positive" }, { value: Math.max(0, task.assignedVolunteers - received), tone: "info" },
          ]} label={`Đã nhận việc ${received}, đã giao ${task.assignedVolunteers} trên ${task.requiredVolunteers} người`} />
          <small>{received} đã nhận việc · {task.assignedVolunteers}/{task.requiredVolunteers} đã giao</small>
          {task.assignments.length > 0 && <ul className={styles.taskPeople}>{task.assignments.map((item) =>
            <li key={item.id}><strong>{item.volunteerName}</strong>
              <StatusPill tone={taskTone(item.status)}>{statusLabels[item.status] ?? item.status}</StatusPill>
              {item.volunteerNote && <p>{item.volunteerNote}</p>}
            </li>)}</ul>}
          {available.length > 0 && task.assignedVolunteers < task.requiredVolunteers && !["COMPLETED", "CANCELLED"].includes(task.status) &&
            <form onSubmit={(event) => void assign(event, task)}><fieldset disabled={busy}><legend>Giao cho người đã xác nhận ca</legend>
              {available.map((person) => <label key={person.registrationId}>
                <input type="checkbox" name="registration" value={person.registrationId} /> {person.fullName}{" "}
              </label>)}
              <button type="submit">Giao việc</button>
            </fieldset></form>}
        </article>;
      })}
      <form onSubmit={create}><fieldset disabled={busy}><legend>Tạo nhiệm vụ</legend>
        <label>Tên nhiệm vụ <input name="name" required minLength={2} maxLength={255} /></label>
        <label>Nội dung <textarea name="description" required maxLength={4000} /></label>
        <label>Số người cần <input name="required" required type="number" min={1} max={group.target} defaultValue={1} /></label>
        <button type="submit">Tạo nhiệm vụ</button>
      </fieldset></form>
    </>}
  </section>;
}

export default function WorkspaceFieldWorkScreen() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PageResult<Program>>();
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Selection>();
  const [receiving, setReceiving] = useState("");
  const [error, setError] = useState("");
  const taskAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setSelection(undefined);
    setReceiving("");
    setData(undefined);
    setError("");
    api<PageResult<Program>>(`/api/campaigns/organization/${id}/assigned-work?page=${page}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [id, page]);

  useEffect(() => {
    if (selection) taskAnchor.current?.scrollIntoView({ block: "start" });
  }, [selection]);

  return <div className={styles.ownerDashboard}>
    <header className={styles.ownerWelcome}><div className={styles.ownerWelcomeCopy}>
      <h1>Việc được giao</h1><p>Lịch, đội và phần việc được phân công trong kế hoạch đã công bố.</p>
    </div></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!data && !error && <p role="status">Đang tải phân công…</p>}
    {data?.items.length === 0 && <p>Chưa có ca được phân công.</p>}
    {data?.items.length ? <StatGrid label="Phân công trên trang">
      <Stat label="Ca trên trang" value={data.items.reduce((sum, program) => sum + program.shifts.length, 0)} tone="info" />
      <Stat label="Hồ sơ có phân công" value={data.totalCount} />
      <Stat label="Hồ sơ có điểm nhận trên trang" value={data.items.filter((program) => program.canReceiveGoods).length} tone="positive" />
    </StatGrid> : null}
    {selection && <div ref={taskAnchor} className={styles.fieldTasks}>
      <TeamTasks key={`${selection.program.id}/${selection.shift.activityId}/${selection.group.id}`} {...selection} />
    </div>}
    {data?.items.map((program) => <section className={styles.ownerPanel} key={program.id}>
      <h2>{program.title}</h2>
      {program.canReceiveGoods && <button type="button" className="secondary" onClick={() =>
        setReceiving(receiving === program.id ? "" : program.id)}>Điểm tiếp nhận được giao</button>}
      {receiving === program.id && <AssignedIntake campaignId={program.id} />}
      <div className={styles.workCards}>{program.shifts.map((shift, index) => <article className={styles.workCard} key={shift.activityId + index}>
        <div><StatusPill tone="info">{shift.team}</StatusPill></div>
        <h3>{shift.activity}</h3>
        <p>{[shift.date, [shift.start?.slice(0, 5), shift.end?.slice(0, 5)].filter(Boolean).join(" – "), shift.location].filter(Boolean).join(" · ")}</p>
        {shift.groups.map((group) => <button key={group.id} type="button" className="secondary" aria-controls="selected-field-tasks"
          aria-pressed={selection?.program.id === program.id && selection.shift.activityId === shift.activityId && selection.group.id === group.id}
          onClick={() => setSelection({ program, shift, group })}>Giao việc · {group.name}</button>)}
      </article>)}</div>
    </section>)}
    {data && data.totalCount > data.pageSize && <nav aria-label="Phân trang ca">
      <button disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button>
      <span>Trang {page}</span>
      <button disabled={page * data.pageSize >= data.totalCount} onClick={() => setPage(page + 1)}>Trang sau</button>
    </nav>}
  </div>;
}
