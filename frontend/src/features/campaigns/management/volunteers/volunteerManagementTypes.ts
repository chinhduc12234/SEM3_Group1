export type Group = {
  id: string; name: string; category: string; target: number; assignedCount: number; remaining: number; confirmedCount: number;
  date: string | null; activityTitle: string | null; teamName: string | null; teamLeaderName: string | null;
};
export type GroupsView = {
  campaignId: string; campaignTitle: string; pendingRegistrations: number; approvedVolunteers: number; groups: Group[];
};
export type GroupMember = { registrationId: string; fullName: string; email: string; phoneNumber: string; assignedAt: string; assignedBy: string };
export type RegistrationSummary = {
  id: string; campaignId: string; fullName: string; email: string; phoneNumber: string; status: string;
  submittedAt: string; groupPreferences: { groupId: string; preferenceRank: number }[];
};
export type RegistrationPage = { campaignId: string; status: string; page: number; pageSize: number; totalCount: number; items: RegistrationSummary[] };
export type RegistrationDetail = RegistrationSummary & {
  dateOfBirth: string | null; occupation: string | null; healthNote: string | null; skills: string | null;
  experience: string | null; motivation: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null;
  commitsToAllDays: boolean; rejectionReason: string | null; reviewNote?: string | null; assignedGroups: { groupId: string; status: string }[];
};
export type Pane = "groups" | "applications";
export const applicationStatuses = {
  SUBMITTED: "Mới gửi", UNDER_REVIEW: "Cần xem xét", WAITLISTED: "Danh sách chờ", APPROVED: "Đã xếp nhóm",
  REJECTED: "Đã từ chối",
};
