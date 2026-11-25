"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/shared/api/api";
import { StatusPill } from "@/shared/ui/StatusVisuals";
import styles from "./CampaignReadinessScreen.module.css";

type Slot = { dayId: string; activityId: string; date: string; activity: string; location: string };
type View = { version: string; canRequest: boolean; canDecide: boolean; slots: Slot[];
  pending: { id: string; before: Slot; newLocation: string; reason: string } | null };

export default function CampaignScheduleChangePanel({ campaignId, reload }: { campaignId: string; reload: () => void }) {
  const endpoint = `/api/campaigns/${campaignId}/schedule-change`;
  const [view, setView] = useState<View>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [slotId, setSlotId] = useState("");
  const slot = view?.slots.find((value) => value.activityId === slotId);

  useEffect(() => {
    const controller = new AbortController();
    api<View>(endpoint, { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) setView(value);
    }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [endpoint, revision]);

  async function submit(event: FormEvent<HTMLFormElement>, decision?: boolean) {
    event.preventDefault();
    if (busy || !view) return;
    const values = new FormData(event.currentTarget);
    const payload = typeof decision === "boolean"
      ? view.pending && { version: view.version, changeId: view.pending.id, approve: decision, note: values.get("note") }
      : slot && { version: view.version, dayId: slot.dayId, activityId: slot.activityId, location: values.get("location"), reason: values.get("reason") };
    if (!payload) return;
    setBusy(true);
    setError("");
    try {
      setView(await api<View>(endpoint + (typeof decision === "boolean" ? "/decision" : ""), {
        method: "POST", body: JSON.stringify(payload),
      }));
      setSlotId("");
      reload();
    } catch (reason) {
      setError((reason as Error).message);
      setRevision((value) => value + 1);
    } finally { setBusy(false); }
  }

  return <section id="schedule-change" className={styles.panel}>
    <h2>Thay đổi địa điểm sau công bố</h2>
    {error && <p className="notice error" role="alert">{error} <button onClick={() => {
      setError(""); setRevision((value) => value + 1);
    }}>Tải lại</button></p>}
    {!view && !error && <p role="status">Đang tải đề xuất…</p>}
    {view?.pending ? <>
      <div><StatusPill tone="warning">Chờ Owner quyết định</StatusPill></div>
      <h3>{view.pending.before.activity} · {view.pending.before.date}</h3>
      <dl className={styles.comparison}>
        <div><dt>Địa điểm đang công bố</dt><dd>{view.pending.before.location}</dd></div>
        <div><dt>Địa điểm đề xuất</dt><dd>{view.pending.newLocation}</dd></div>
      </dl>
      <p><strong>Lý do</strong> · {view.pending.reason}</p>
      {view.canDecide ? <form onSubmit={(event) => {
        const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (button) void submit(event, button.value === "approve");
        else event.preventDefault();
      }}><label>Lý do quyết định <textarea name="note" minLength={3} maxLength={1000} required /></label>
        <div className={styles.actions}>
          <button className="primary" value="approve" disabled={busy} type="submit">Duyệt đổi địa điểm</button>
          <button className="secondary" value="reject" disabled={busy} type="submit">Từ chối</button>
        </div>
      </form> : null}
    </> : view?.canRequest ? <form onSubmit={(event) => void submit(event)}>
      <label>Hoạt động <select value={slotId} onChange={(event) => setSlotId(event.target.value)} required>
        <option value="">Chọn hoạt động</option>
        {view.slots.map((value) => <option key={value.activityId} value={value.activityId}>{value.date} · {value.activity}</option>)}
      </select></label>
      {slot && <p>Địa điểm hiện tại {slot.location}</p>}
      <label>Địa điểm mới <input name="location" minLength={5} maxLength={400} required /></label>
      <label>Lý do đổi địa điểm <textarea name="reason" minLength={5} maxLength={1000} required /></label>
      <button className="primary" type="submit" disabled={busy || !slot}>Gửi Owner duyệt</button>
    </form> : view && <p>Hiện chưa có đề xuất cần xử lý.</p>}
  </section>;
}
