import type { Campaign, PlannedCampaignAddress } from "../types/campaigns";

export function formatPlannedAddress(address: PlannedCampaignAddress) {
  return [address.detail?.trim(), address.ward?.name, address.district?.name, address.province?.name]
    .filter(Boolean).join(", ");
}

export function conceptForm(campaign: Campaign | null) {
  const concept = campaign?.concept;
  return {
    campaignType: campaign?.campaignType === "EVENT" ? "EVENT" : "CAMPAIGN",
    title: campaign?.title ?? "",
    cause: campaign?.cause ?? "",
    shortDescription: concept?.shortDescription ?? "",
    contactEmail: campaign?.contactEmail ?? "",
    contactPhone: campaign?.contactPhone ?? "",
    description: campaign?.description ?? "",
    primaryGoal: concept?.primaryGoal ?? "",
    mission: concept?.mission ?? "",
    expectedOutcomes: concept?.expectedOutcomes ?? "",
    successCriteria: concept?.successCriteria ?? "",
    beneficiaryDescription: campaign?.beneficiaryDescription ?? "",
    estimatedBeneficiaries: concept?.estimatedBeneficiaries?.toString() ?? "",
    beneficiaryCriteria: concept?.beneficiaryCriteria ?? "",
    location: campaign?.concept?.plannedAddress ? "" : campaign?.location ?? "",
    startDate: campaign?.startDate ?? "",
    endDate: campaign?.endDate ?? "",
    tentativeTime: concept?.tentativeTime ?? "",
    plannedScale: concept?.plannedScale ?? "",
    initialRequirements: concept?.initialRequirements ?? "",
    riskNotes: concept?.riskNotes ?? "",
    eventFormat: concept?.eventFormat ?? "",
    onlinePlatform: concept?.onlinePlatform ?? "",
    eventStartTime: concept?.eventStartTime?.slice(0, 5) ?? "",
    eventEndTime: concept?.eventEndTime?.slice(0, 5) ?? "",
    parentCampaignId: concept?.parentCampaignId ?? "",
  };
}

export type ConceptForm = ReturnType<typeof conceptForm>;
type Field = {
  key: keyof ConceptForm;
  label: string;
  type?: "textarea" | "date" | "number" | "time" | "email" | "tel";
  max?: number;
  required?: boolean;
  placeholder?: string;
  wide?: boolean;
};

export const conceptSteps: { title: string; fields: Field[] }[] = [
  {
    title: "Thông tin chung",
    fields: [
      { key: "title", label: "Tên chương trình", max: 200, required: true, wide: true, placeholder: "Ví dụ: Tiếp sức đến trường" },
      { key: "shortDescription", label: "Mô tả ngắn", type: "textarea", max: 500, required: true },
      { key: "contactEmail", label: "Email đầu mối", type: "email", max: 256 },
      { key: "contactPhone", label: "Điện thoại đầu mối", type: "tel", max: 25 },
    ],
  },
  {
    title: "Bối cảnh và mục tiêu",
    fields: [
      { key: "description", label: "Bối cảnh và vấn đề cần giải quyết", type: "textarea", max: 10000, required: true, wide: true },
      { key: "primaryGoal", label: "Mục tiêu chính", type: "textarea", required: true },
      { key: "mission", label: "Ý nghĩa chương trình", type: "textarea", required: true },
      { key: "expectedOutcomes", label: "Kết quả mong đợi", type: "textarea" },
      { key: "successCriteria", label: "Tiêu chí thành công sơ bộ", type: "textarea" },
    ],
  },
  {
    title: "Đối tượng hưởng lợi",
    fields: [
      { key: "beneficiaryDescription", label: "Nhóm người được hỗ trợ", type: "textarea", required: true, wide: true },
      { key: "estimatedBeneficiaries", label: "Số người dự kiến", type: "number" },
      { key: "beneficiaryCriteria", label: "Tiêu chí lựa chọn", type: "textarea" },
    ],
  },
  {
    title: "Phạm vi dự kiến",
    fields: [
      { key: "startDate", label: "Ngày bắt đầu dự kiến", type: "date" },
      { key: "endDate", label: "Ngày kết thúc dự kiến", type: "date" },
      { key: "tentativeTime", label: "Khung thời gian dự kiến", max: 200, wide: true, placeholder: "Ví dụ: một buổi sáng cuối tuần trong tháng 1" },
      { key: "plannedScale", label: "Phạm vi và quy mô chương trình", type: "textarea", required: true, wide: true },
      { key: "initialRequirements", label: "Nhu cầu hỗ trợ sơ bộ", type: "textarea" },
      { key: "riskNotes", label: "Rủi ro hoặc điều kiện đặc biệt", type: "textarea" },
    ],
  },
];

export function fieldsForStep(step: number, { campaignType, eventFormat }: ConceptForm): Field[] {
  const fields = conceptSteps[step].fields;
  if (step !== 3 || campaignType !== "EVENT") return fields;

  return [
    ...(eventFormat === "ONLINE" || eventFormat === "HYBRID" ? [{
      key: "onlinePlatform" as const, label: "Nền tảng trực tuyến dự kiến", max: 200, wide: true,
      placeholder: "Ví dụ: Google Meet hoặc Zoom",
    }] : []),
    ...fields.slice(0, 2),
    { key: "eventStartTime", label: "Giờ bắt đầu dự kiến", type: "time" },
    { key: "eventEndTime", label: "Giờ kết thúc dự kiến", type: "time" },
    ...fields.slice(2),
  ];
}

export const eventFormats: Record<string, string> = {
  IN_PERSON: "Trực tiếp",
  ONLINE: "Trực tuyến",
  HYBRID: "Kết hợp",
};
