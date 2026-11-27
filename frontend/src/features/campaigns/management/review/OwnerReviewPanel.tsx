import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";

type Props = Pick<CampaignManagementModel, "busy" | "note" | "setNote" | "reviewCampaign">;

export default function OwnerReviewPanel({ busy, note, setNote, reviewCampaign }: Props) {
  return (
    <LocalizedTree>
      <section>
          <h3>Duyệt ý tưởng</h3>
        <label>
          Nhận xét / lý do
          <textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="actions">
          {(
            [
              ["APPROVE", "Chấp thuận chủ trương"],
              ["REQUEST_CHANGES", "Yêu cầu chỉnh sửa"],
              ["REJECT", "Từ chối"],
            ] as const
          ).map(([decision, label]) => (
            <button
              type="button"
              key={decision}
              disabled={busy || (decision !== "APPROVE" && !note.trim())}
              onClick={() => void reviewCampaign(decision)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </LocalizedTree>
  );
}
