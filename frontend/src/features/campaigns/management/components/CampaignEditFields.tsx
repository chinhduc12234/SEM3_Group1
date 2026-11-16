import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import { campaignFields } from "@/features/campaigns/management/campaignManagement";
import type { Campaign } from "@/features/campaigns/types/campaigns";
import { causes } from "@/features/campaigns/types/campaigns";

type Props = Pick<
  CampaignManagementModel,
  "busy" | "publishedEditable" | "selected" | "setEditingSelected"
>;

export default function CampaignEditFields({
  busy,
  publishedEditable,
  selected,
  setEditingSelected,
}: Props) {
  return (
    <LocalizedTree>
      <>
        {campaignFields.map(([key, label, type]) => (
          <label key={key}>
            {label}
            {type === "textarea" ? (
              <textarea
                name={key}
                readOnly={publishedEditable && !["title", "description"].includes(key)}
                required
                minLength={1}
                maxLength={key === "description" ? 10000 : 4000}
                defaultValue={selected?.[key as keyof Campaign] as string}
              />
            ) : (
              <input
                name={key}
                readOnly={publishedEditable && !["title", "description"].includes(key)}
                type={type}
                required={key !== "contactEmail"}
                min={type === "number" ? 1 : undefined}
                step={key === "goalAmount" ? "0.01" : undefined}
                maxLength={key === "title" ? 200 : 400}
                defaultValue={selected?.[key as keyof Campaign] as string | number}
              />
            )}
          </label>
        ))}
        <label>
          Danh mục
          <select
            disabled={publishedEditable}
            name="cause"
            defaultValue={selected?.cause || "EDUCATION"}
          >
            {Object.entries(causes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button type="submit">{publishedEditable ? "Lưu thay đổi" : "Lưu bản nháp"}</button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setEditingSelected(false)}
          >
            Hủy
          </button>
        </div>
      </>
    </LocalizedTree>
  );
}
