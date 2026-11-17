import type { Campaign } from "@/features/campaigns/types/campaigns";

export type CampaignRow = Pick<
  Campaign,
  | "id"
  | "title"
  | "description"
  | "campaignType"
  | "createdBy"
  | "cause"
  | "goalAmount"
  | "volunteerTarget"
  | "startDate"
  | "endDate"
  | "location"
  | "status"
  | "operationsConfirmedAt"
> & { coverMediaId: string | null; isAssigned: boolean; budgetConfirmedAt: string | null; budgetNeedsReview: boolean; legacyPublished: boolean };
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

export type CampaignReviewDecision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";
