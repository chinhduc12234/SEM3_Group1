import type { Campaign } from "@/features/campaigns/types/campaigns";

export type Bank = { code: string; shortName: string; name: string; logo: string };
export type CampaignRow = Pick<
  Campaign,
  | "id"
  | "title"
  | "description"
  | "cause"
  | "goalAmount"
  | "volunteerTarget"
  | "startDate"
  | "endDate"
  | "location"
  | "status"
> & { coverMediaId: string | null };
export const campaignFields = [
  ["title", "Tên chiến dịch", "text"],
  ["description", "Mô tả", "textarea"],
  ["beneficiaryDescription", "Đối tượng thụ hưởng", "textarea"],
  ["goalAmount", "Mục tiêu quyên góp (VND)", "number"],
  ["volunteerTarget", "Số tình nguyện viên cần", "number"],
  ["startDate", "Ngày bắt đầu", "date"],
  ["endDate", "Ngày kết thúc", "date"],
  ["location", "Địa điểm", "text"],
  ["contactEmail", "Email liên hệ", "email"],
  ["contactPhone", "Điện thoại liên hệ", "tel"],
];

export const activityConflict = (
  activities: { id: number; start: string; end: string }[],
  current: { id: number; start: string; end: string },
) =>
  current.start !== "" &&
  current.end !== "" &&
  current.start < current.end &&
  activities.some(
    (other) =>
      other.id !== current.id &&
      other.start !== "" &&
      other.end !== "" &&
      other.start < other.end &&
      current.start < other.end &&
      other.start < current.end,
  );

const DAY_IN_MS = 86_400_000;

export function getCampaignScheduleRange(startDate: string, endDate: string) {
  const start = Date.parse(startDate + "T00:00:00Z");
  const end = Date.parse(endDate + "T00:00:00Z");
  const scheduleLimit =
    Number.isFinite(start) && Number.isFinite(end)
      ? Math.max(0, Math.round((end - start) / DAY_IN_MS))
      : 0;
  return {
    scheduleLimit,
    lastScheduleDate: scheduleLimit > 0 ? new Date(end - DAY_IN_MS).toISOString().slice(0, 10) : "",
  };
}

export type CampaignReviewDecision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";
