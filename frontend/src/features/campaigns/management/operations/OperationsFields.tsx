import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "../CampaignManagement.module.css";
import type { Day, Member } from "./operationsTypes";

export function dayLabel(day: Day, index: number) {
  return [day.date && formatCampaignDate(day.date), day.title || `Ngày ${index + 1}`, day.activitiesDone && "Đã xong"]
    .filter(Boolean).join(" · ");
}

export function field(label: string, value: string | null, change: (value: string) => void,
  type: "text" | "textarea" | "date" | "time" = "text") {
  return <label>{label}
    {type === "textarea" ? <textarea rows={2} value={value ?? ""} onChange={(e) => change(e.target.value)} /> :
      <input type={type} value={type === "time" ? value?.slice(0, 5) ?? "" : value ?? ""} onChange={(e) => change(e.target.value)} />}
  </label>;
}

export function quantity(label: string, value: number, change: (value: number) => void) {
  return <label>{label}<input type="number" min={0} max={100000}
    step={1} value={value} onChange={(e) => change(e.target.valueAsNumber || 0)} /></label>;
}

export function person(label: string, members: Member[], value: string | null, change: (value: string | null) => void,
  unavailableLabel = "Nhân sự không còn hoạt động") {
  return <label>{label}<select value={value ?? ""} onChange={(e) => change(e.target.value || null)}>
    <option value="">Chưa chọn</option>
    {value && !members.some((member) => member.userId === value) && <option value={value}>{unavailableLabel}</option>}
    {members.map(({ userId, fullName }) => <option key={userId} value={userId}>{fullName}</option>)}
  </select></label>;
}

export function Checklist({ label, options, values, change }: {
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

export function replace<T extends { id: string }>(items: T[], id: string, updates: Partial<T>) {
  return items.map((item) => item.id === id ? { ...item, ...updates } : item);
}
