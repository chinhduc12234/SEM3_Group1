import { useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "../CampaignManagement.module.css";
import type { CampaignManagementModel } from "../hooks/useCampaignManagement";
import type { OperationsView } from "../operations/operationsTypes";

export default function CampaignExtraDayApprovals({ campaignId, version, busy, action, onApproved }: {
  campaignId: string;
  version: string;
  busy: boolean;
  action: CampaignManagementModel["action"];
  onApproved: (version: string) => void;
}) {
  const [view, setView] = useState<OperationsView>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const endpoint = `/api/campaigns/${campaignId}/operations`;

  useEffect(() => {
    const controller = new AbortController();
    api<OperationsView>(endpoint, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setView(result); })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [endpoint, version, retry]);

  const days = view?.plan.days.filter((day) => day.extraReason) ?? [];

  return <section className={styles.reviewBlock}>
    <h3>Duyệt ngày triển khai bổ sung</h3>
    {error && <p className="notice error" role="alert">{error} <button className="quiet" type="button"
      onClick={() => { setError(""); setRetry((count) => count + 1); }}>Tải lại</button></p>}
    {!view && !error && <p role="status">Đang tải ngày bổ sung…</p>}
    {view && days.length === 0 && <p className="muted">Chưa có ngày bổ sung.</p>}
    {view && days.map((day) => <div className={styles.operationsSummaryItem} key={day.id}>
      <strong>{formatCampaignDate(day.date)} · {day.title}</strong>
      <p>{day.extraReason}</p>
      {day.extraApprovedAt ? <p>Đã duyệt</p> : view.canApproveExtraDays &&
        <button type="button" className="secondary" disabled={busy} onClick={() => void action(async () => {
          const result = await api<OperationsView>(`${endpoint}/extra-days/${day.id}/approve`, {
            method: "POST", body: JSON.stringify({ version: view.version }),
          });
          setView(result);
          onApproved(result.version);
        }, false)}>Duyệt ngày bổ sung</button>}
    </div>)}
  </section>;
}
