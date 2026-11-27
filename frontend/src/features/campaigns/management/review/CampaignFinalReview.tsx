import { useState } from "react";
import { api } from "@/shared/api/api";
import type { Campaign } from "../../types/campaigns";
import type { CampaignManagementModel } from "../hooks/useCampaignManagement";
import CampaignBudgetOverview from "../budget/CampaignBudgetOverview";
import CampaignOperationsOverview from "../operations/CampaignOperationsOverview";
import PlanReadiness from "./PlanReadiness";
import styles from "../CampaignManagement.module.css";

const revisionAreas = { OPERATIONS: "Vận hành", BUDGET: "Ngân sách", BOTH: "Vận hành và ngân sách" } as const;
const finalActions: Record<string, string> = {
  FINAL_SUBMIT: "Gửi duyệt cuối", FINAL_APPROVE: "Phê duyệt kế hoạch cuối", PUBLISH: "Công bố",
  FINAL_REJECT: "Từ chối kế hoạch cuối",
  FINAL_RETURN_OPERATIONS: "Yêu cầu sửa vận hành", FINAL_RETURN_BUDGET: "Yêu cầu sửa ngân sách",
  FINAL_RETURN_BOTH: "Yêu cầu sửa vận hành và ngân sách",
};

export default function CampaignFinalReview({ campaign, owner, canSubmit, busy, action, onUpdate }: {
  campaign: Campaign; owner: boolean; canSubmit: boolean; busy: boolean;
  action: CampaignManagementModel["action"];
  onUpdate: (campaign: Campaign, message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [area, setArea] = useState<string>("");
  const ready = !!campaign.operationsConfirmedAt && !!campaign.budgetConfirmedAt && !campaign.budgetNeedsReview;
  const pending = campaign.status === "PENDING_FINAL_REVIEW";
  const approved = campaign.status === "FINAL_APPROVED";
  const history = campaign.reviews.filter((review) => review.action in finalActions);

  function post(path: string, values: object, message: string) {
    void action(async () => {
      const updated = await api<Campaign>(`/api/campaigns/${campaign.id}/${path}`, {
        method: "POST", body: JSON.stringify({ ...values, version: campaign.version }),
      });
      setNote("");
      setArea("");
      onUpdate(updated, message);
    }, false);
  }

  return <section className={styles.reviewBlock}>
    <h3>{campaign.status === "PLANNING" ? "Kiểm tra trước duyệt cuối" : "Duyệt kế hoạch cuối"}</h3>
    {campaign.status === "PLANNING" && <>
      <PlanReadiness {...campaign} />
      {canSubmit && <div className="actions">
        <button type="button" disabled={busy || !ready} onClick={() => post("final/submit", {}, "Đã gửi kế hoạch cho Owner duyệt cuối.")}>
          Gửi duyệt kế hoạch cuối
        </button>
      </div>}
    </>}
    {owner && (pending || approved) && <>
      <details className={styles.operationsSummaryItem}>
        <summary>Kế hoạch vận hành đã gửi</summary>
        <CampaignOperationsOverview campaign={campaign} loadMapOnDemand />
      </details>
      <details className={styles.operationsSummaryItem}>
        <summary>Dự toán và phương thức nhận hỗ trợ đã gửi</summary>
        <CampaignBudgetOverview campaignId={campaign.id} planning />
      </details>
    </>}
    {owner && pending && <div>
      <label>Nhận xét duyệt cuối<textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} /></label>
      <label>Phần cần chỉnh sửa<select value={area} onChange={(event) => setArea(event.target.value)}>
        <option value="">Chọn khi yêu cầu sửa</option>
        {Object.entries(revisionAreas).map(([key, title]) => <option key={key} value={key}>{title}</option>)}
      </select></label>
      <div className="actions">
        <button type="button" disabled={busy || !campaign.finalSubmissionId} onClick={() =>
          post("final/review", { submissionId: campaign.finalSubmissionId, decision: "APPROVE", note }, "Đã duyệt kế hoạch cuối. Hồ sơ đang chờ công bố.")}>
          Phê duyệt kế hoạch cuối
        </button>
        <button className="secondary" type="button" disabled={busy || !campaign.finalSubmissionId || !area || !note.trim()} onClick={() =>
          post("final/review", { submissionId: campaign.finalSubmissionId, decision: "REQUEST_CHANGES", revisionArea: area, note }, "Đã trả hồ sơ để chỉnh sửa phần được chọn.")}>
          Yêu cầu chỉnh sửa kế hoạch
        </button>
        <button className="secondary" type="button" disabled={busy || !campaign.finalSubmissionId || !note.trim()} onClick={() =>
          post("final/review", { submissionId: campaign.finalSubmissionId, decision: "REJECT", note }, "Đã từ chối kế hoạch cuối.")}>
          Từ chối kế hoạch cuối
        </button>
      </div>
    </div>}
    {owner && approved && <div className="actions">
      <button type="button" disabled={busy} onClick={() => post("publish", {}, "Đã công bố hồ sơ.")}>Công bố hồ sơ</button>
    </div>}
    {history.length > 0 && <ul>
      {[...history].reverse().map((review) => <li key={review.id}>
        <strong>{finalActions[review.action]}</strong> · <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleString("vi-VN")}</time>
        {review.note && <p>{review.note}</p>}
      </li>)}
    </ul>}
  </section>;
}
