import { useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import { assignmentRoles, type AssignmentRole, type Campaign, type CampaignAssignmentInput } from "../../types/campaigns";
import styles from "../CampaignManagement.module.css";

type Candidate = { userId: string; fullName: string; roles: AssignmentRole[] };
const roles = Object.keys(assignmentRoles) as AssignmentRole[];

export default function CampaignAssignmentPanel({ campaign, busy, onSave }: {
  campaign: Campaign; busy: boolean; onSave: (items: CampaignAssignmentInput[]) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [items, setItems] = useState<CampaignAssignmentInput[]>(campaign.assignments);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<Candidate[]>(`/api/campaigns/${campaign.id}/assignment-candidates`, { signal: controller.signal })
      .then((members) => {
        if (controller.signal.aborted) return;
        setCandidates(members);
        if (campaign.status === "CONCEPT_APPROVED" &&
            members.some((member) => member.userId === campaign.createdBy && member.roles.includes("CAMPAIGN_MANAGER"))) {
          setItems([{ userId: campaign.createdBy, role: "CAMPAIGN_MANAGER", isPrimary: true }]);
        }
      })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [campaign.id, campaign.createdBy, campaign.status, retry]);

  const eligible = (item: CampaignAssignmentInput) => candidates?.some((c) =>
    c.userId === item.userId && c.roles.includes(item.role));
  const complete = !!candidates && items.every(eligible) &&
    roles.every((role) => items.some((item) => item.role === role && item.isPrimary));

  return (
    <section className={styles.reviewBlock} aria-labelledby="assignment-title">
      <h3 id="assignment-title">Phân công người phụ trách</h3>
      {!campaign.assignments.length && <p className="muted">Chờ cập nhật</p>}
      {error && <p className="notice error" role="alert">{error} <button className="quiet" type="button" onClick={() => setRetry(retry + 1)}>Tải lại</button></p>}
      {!candidates && !error && <p role="status">Đang tải nhân sự…</p>}
      {candidates && <form onSubmit={(event) => { event.preventDefault(); if (complete) onSave(items); }}>
        <div className={styles.assignmentGrid}>
          {roles.map((role) => {
            const available = candidates.filter((member) => member.roles.includes(role));
            const primary = items.find((item) => item.role === role && item.isPrimary);
            const helpers = items.filter((item) => item.role === role && !item.isPrimary);
            return <fieldset className={styles.assignmentRole} key={role} disabled={busy}>
              <legend>{assignmentRoles[role]}</legend>
              <label>
                Người phụ trách chính
                <select value={primary?.userId ?? ""} onChange={(event) => {
                  const userId = event.target.value;
                  setItems((current) => [
                    ...current.filter((item) => item.role !== role || (!item.isPrimary && item.userId !== userId)),
                    ...(userId ? [{ userId, role, isPrimary: true }] : []),
                  ]);
                }}>
                  <option value="">Chọn người phụ trách</option>
                  {primary && !eligible(primary) && <option value={primary.userId}>Người đã chọn không còn đủ quyền</option>}
                  {available.map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}
                </select>
              </label>
              {!available.length && <p className="muted">Chưa có nhân sự đủ quyền cho vai trò này.</p>}
              {helpers.map((item) => <div className={styles.assignmentHelper} key={item.userId}>
                <span>{available.find((member) => member.userId === item.userId)?.fullName || "Nhân sự không còn đủ quyền"}</span>
                <button type="button" className="quiet" onClick={() => setItems((current) => current.filter((x) => x !== item))}>Bỏ</button>
              </div>)}
              {available.some((member) => !items.some((item) => item.role === role && item.userId === member.userId)) &&
                <label>
                  Nhân sự hỗ trợ
                  <select value="" onChange={(event) => {
                    const userId = event.target.value;
                    if (userId && items.length < 30) setItems((current) => [...current, { userId, role, isPrimary: false }]);
                  }}>
                    <option value="">Thêm người hỗ trợ</option>
                    {available.filter((member) => !items.some((item) => item.role === role && item.userId === member.userId))
                      .map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}
                  </select>
                </label>}
            </fieldset>;
          })}
        </div>
        <div className="actions"><button disabled={busy || !complete}>Lưu phân công</button></div>
      </form>}
    </section>
  );
}
