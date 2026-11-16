import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import CampaignRouteMap from "@/features/campaigns/components/CampaignRouteMap";

type Props = Pick<
  CampaignManagementModel,
  "province" | "routeStops" | "setReview" | "setStep" | "step"
>;

export default function CampaignLocationsStep({
  province,
  routeStops,
  setReview,
  setStep,
  step,
}: Props) {
  return (
    <LocalizedTree>
      <div hidden={step !== 7}>
        <h3>Địa điểm hoạt động</h3>
        {step === 7 && <CampaignRouteMap province={province} stops={routeStops} />}
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setStep(6)}>
            ← Quay lại
          </button>
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (!form) return;
              const data = new FormData(form);
              const fields = [
                "title",
                "description",
                "cause",
                "contactEmail",
                "contactPhone",
                "bankName",
                "otherBankName",
                "bankAccountHolder",
                "bankAccountNumber",
                "goodsDescription",
                "goodsTarget",
                "goodsAddress",
                "transparencyCommitment",
                "volunteerCount",
                "volunteerHealth",
                "volunteerSkills",
                "volunteerDescription",
              ];
              setReview(
                Object.fromEntries(fields.map((key) => [key, String(data.get(key) || "")])),
              );
              setStep(8);
            }}
          >
            Tiếp theo →
          </button>
        </div>
      </div>
    </LocalizedTree>
  );
}
