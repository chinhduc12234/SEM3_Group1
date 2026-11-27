import { useState } from "react";
import styles from "../CampaignManagement.module.css";
import { quantity } from "./OperationsFields";
import type { Activity, Attendance } from "./operationsTypes";

const emptyAttendance: Attendance = { staffConfirmed: 0, staffPresent: 0, volunteersConfirmed: 0, volunteersPresent: 0 };

export default function AttendanceForm({ activity, disabled, onSave }: { activity: Activity; disabled: boolean; onSave: (counts: Attendance) => void }) {
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
