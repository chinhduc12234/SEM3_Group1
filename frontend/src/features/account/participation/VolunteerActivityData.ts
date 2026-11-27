import { useEffect, useState } from "react";
import { api } from "@/shared/api/api";

export const registrationEndpoint = "/api/volunteers/me/registrations";
export const participationPath = "/account/participation";

export type Offer = {
  id: string; groupId: string; status: string; confirmBy: string | null; confirmedAt: string | null;
};
export type RegistrationProfile = {
  fullName: string; email: string; phoneNumber: string; dateOfBirth: string | null; occupation: string | null;
  skills: string | null; experience: string | null; motivation: string | null; emergencyContactName: string | null;
  emergencyContactPhone: string | null; availableDates: string[] | null; commitsToAllDays: boolean; preferredGroupIds: string[];
};
export type Registration = {
  id: string; campaignId: string; status: string; note: string | null; submittedAt: string; offers: Offer[];
  profile?: RegistrationProfile;
};

export const statuses: Record<string, string> = {
  SUBMITTED: "Đã gửi", UNDER_REVIEW: "Đang xét duyệt", APPROVED: "Đã được xếp ca",
  WAITLISTED: "Danh sách chờ", REJECTED: "Từ chối",
  ASSIGNED: "Chờ phản hồi", ACCEPTED: "Đã nhận việc", IN_PROGRESS: "Đang thực hiện",
  DECLINED: "Đã báo vướng mắc", COMPLETED: "Đã hoàn thành", CANCELLED: "Đã hủy",
};

export const statusTone = (status: string) => ["APPROVED", "ACCEPTED", "COMPLETED"].includes(status) ? "positive" :
  ["UNDER_REVIEW", "WAITLISTED", "ASSIGNED", "DECLINED"].includes(status) ? "warning" : status === "REJECTED" ? "danger" : "neutral";

export function useActivityCampaigns(rows: readonly { campaignId: string }[]) {
  const [campaigns, setCampaigns] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    for (const id of new Set(rows.map((row) => row.campaignId))) {
      api<{ title: string }>(`/api/campaigns/${encodeURIComponent(id)}`, { signal: controller.signal })
        .then(({ title }) => {
          if (!controller.signal.aborted && title) setCampaigns((current) => ({ ...current, [id]: title }));
        })
        .catch(() => { /* Keep the activity visible when campaign details are unavailable. */ });
    }
    return () => controller.abort();
  }, [rows]);
  return campaigns;
}
