"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/shared/api/api";
import { StatusPill } from "@/shared/ui/StatusVisuals";
import { ActivityList } from "../components/AccountActivity";
import { statuses, statusTone } from "./VolunteerActivityData";

type Task = {
  assignmentId: string; campaignId: string; name: string; description: string; startTime: string | null;
  endTime: string | null; assignmentStatus: string; volunteerNote: string | null;
};

export default function AccountVolunteerTasks() {
  const [tasks, setTasks] = useState<Task[]>();
  const [taskError, setTaskError] = useState("");
  const [reporting, setReporting] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<Task[]>("/api/volunteers/me/tasks", { signal: controller.signal })
      .then((rows) => { if (!controller.signal.aborted) setTasks(rows); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setTaskError(reason.message); });
    return () => controller.abort();
  }, []);

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

  return <ActivityList title="Nhiệm vụ được giao">
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
    </ActivityList>;
}
