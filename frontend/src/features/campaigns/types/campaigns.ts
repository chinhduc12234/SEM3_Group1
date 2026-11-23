export const causes: Record<string, string> = {
  CHILDREN: "Trẻ em",
  EDUCATION: "Giáo dục",
  DISABLED: "Người khuyết tật",
  WOMEN: "Phụ nữ",
  YOUTH: "Thanh niên",
  ELDERLY: "Người cao tuổi",
  HEALTH: "Sức khỏe",
  DISASTER_RELIEF: "Thiên tai",
  ENVIRONMENT: "Môi trường",
  COMMUNITY: "Cộng đồng",
};
export const campaignStatuses: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING_REVIEW: "Chờ Owner duyệt",
  PENDING_CONCEPT_APPROVAL: "Chờ duyệt ý tưởng",
  CONCEPT_APPROVED: "Đã duyệt ý tưởng · Chờ phân công",
  PLANNING: "Đang lập kế hoạch",
  PENDING_FINAL_REVIEW: "Chờ duyệt kế hoạch cuối",
  FINAL_APPROVED: "Đã duyệt cuối · Chờ công bố",
  FINAL_REJECTED: "Từ chối kế hoạch cuối",
  NEEDS_REVISION: "Cần chỉnh sửa",
  REJECTED: "Đã từ chối",
  PUBLISHED: "Đã công khai",
};
export const campaignTypes: Record<string, string> = {
  CAMPAIGN: "Chiến dịch",
  EVENT: "Sự kiện",
  COMBINED: "Chiến dịch",
};
export type CampaignConcept = {
  shortDescription: string;
  primaryGoal: string;
  mission: string;
  expectedOutcomes: string;
  successCriteria: string;
  estimatedBeneficiaries: number | null;
  beneficiaryCriteria: string;
  plannedScale: string;
  initialRequirements: string;
  riskNotes: string;
  tentativeTime: string;
  eventFormat: string | null;
  parentCampaignId: string | null;
  timezone: string;
  onlinePlatform?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  plannedAddress?: PlannedCampaignAddress | null;
};
export type AddressUnit = { code: number; name: string };
export type PlannedCampaignAddress = {
  mode: "CURRENT" | "LEGACY";
  province: AddressUnit | null;
  district: AddressUnit | null;
  ward: AddressUnit | null;
  detail: string;
};
export type CampaignListItem = {
  id: string;
  title: string;
  description: string;
  cause: string;
  goalAmount: number;
  volunteerTarget: number;
  location: string;
  coverMediaId: string | null;
  campaignType?: string;
};
export type Campaign = {
  id: string;
  code: string;
  organizationId: string;
  createdBy: string;
  title: string;
  description: string;
  campaignType: string;
  cause: string;
  beneficiaryDescription: string;
  goalAmount: number;
  volunteerTarget: number;
  startDate: string | null;
  endDate: string | null;
  location: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  version: string;
  additionalDetails: string;
  concept: CampaignConcept | null;
  parentCampaignTitle: string | null;
  assignments: CampaignAssignment[];
  operationsConfirmedAt: string | null;
  budgetConfirmedAt: string | null;
  budgetNeedsReview: boolean;
  finalSubmissionId: string | null;
  publicPlan?: PublicCampaignPlan | null;
  media: { id: string; kind: string; fileName: string; contentType: string }[];
  reviews: { id: string; action: string; note: string; createdAt: string }[];
};

export type PublicCampaignPlan = {
  summary: string; goal: string; outcomes: string; eventFormat: string | null; fundraisingPurpose: string;
  fundingTargets?: { id: string; name: string; category: string; amount: number; quantity: number; unit: string; acceptsInKind: boolean }[] | null;
  inKindTargets?: { id: string; name: string; category: string; amount: number; quantity: number; unit: string; acceptsInKind: boolean }[] | null;
  receiving?: {
    bank?: {
      bankName: string; accountHolder: string; accountNumber: string; qrMediaId: string | null; transferNote: string;
    } | null;
    goods?: { acceptedItems: string; address: string; receivingHours: string; contact: string } | null;
  } | null;
  days: {
    id: string; date: string | null; title: string; description: string; location: string;
    province: string | null; district: string | null; ward: string | null;
    mapPin: { latitude: number; longitude: number } | null;
    activities: { title: string; start: string | null; end: string | null; location: string }[];
  }[];
};

export const assignmentRoles = {
  CAMPAIGN_MANAGER: "Quản lý chiến dịch",
  VOLUNTEER_COORDINATOR: "Quản lý vận hành",
  FINANCE_MANAGER: "Quản lý tài chính",
} as const;
export type AssignmentRole = keyof typeof assignmentRoles;
export type CampaignAssignmentInput = { userId: string; role: AssignmentRole; isPrimary: boolean };
export type CampaignAssignment = CampaignAssignmentInput & { fullName: string };
