import { useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import styles from "../CampaignManagement.module.css";
import CampaignBudgetSummary, { BudgetFigures, BudgetStatus } from "./CampaignBudgetSummary";
import type { BudgetView } from "./budget";

export default function CampaignBudgetOverview({ campaignId, planning }: { campaignId: string; planning: boolean }) {
  const [view, setView] = useState<BudgetView>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!planning) return;
    const controller = new AbortController();
    api<BudgetView>(`/api/campaigns/${campaignId}/budget`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setView(result); })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [campaignId, planning, retry]);

  if (error) return <p className="notice error" role="alert">{error} <button type="button" className="quiet"
    onClick={() => { setError(""); setRetry((count) => count + 1); }}>Tải lại</button></p>;
  if (planning && !view) return <p role="status">Đang tải ngân sách…</p>;
  if (!view?.confirmedAt || !view.plan || !view.totals) return <section className={styles.reviewBlock}>
    <h3>Ngân sách</h3>
    <p className="muted">{view?.needsReview ? "Ngân sách cần rà soát" : "Chờ cập nhật"}</p>
  </section>;

  return <>
    <div className={styles.detailMeta}>
      <BudgetStatus confirmedAt={view.confirmedAt} needsReview={view.needsReview} />
      {view.confirmedByName && <span>{view.confirmedByName}</span>}
      <time dateTime={view.confirmedAt}>{new Date(view.confirmedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
    </div>
    <BudgetFigures totals={view.totals} minimum={view.plan.minimumAmount} />
    <CampaignBudgetSummary campaignId={campaignId} view={view} plan={view.plan} totals={view.totals} />
  </>;
}
