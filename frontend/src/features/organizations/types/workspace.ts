export const memberRoles: Record<string, string> = {
  OWNER: "Chủ tổ chức", ORGANIZATION_MANAGER: "Quản lý tổ chức", CAMPAIGN_MANAGER: "Quản lý chiến dịch",
  VOLUNTEER_COORDINATOR: "Điều phối tình nguyện", FINANCE_MANAGER: "Quản lý tài chính", STAFF: "Nhân viên", SURVEY_STAFF: "Nhân viên khảo sát"
};
export const focusAreas: Record<string, string> = {
  EDUCATION: "Giáo dục", HEALTH: "Y tế", POVERTY_RELIEF: "Hỗ trợ hoàn cảnh khó khăn", DISASTER_RELIEF: "Cứu trợ thiên tai",
  ENVIRONMENT: "Môi trường", CHILDREN: "Trẻ em", ELDERLY: "Người cao tuổi", COMMUNITY: "Cộng đồng"
};
export type WorkspaceProfile = {
  displayName: string; introduction: string; mission: string; focusAreas: string[]; contactEmail: string;
  contactPhone: string; website: string; address: string; hasLogo: boolean; hasCover: boolean; version: string; updatedAt: string;
};
export type Workspace = {
  id: string; legalName: string; registrationNumber: string; representativeName: string; representativeTitle: string;
  status: string; roles: string[]; canEdit: boolean; canManageMembers: boolean; invitableRoles: string[]; profile: WorkspaceProfile;
  statistics: { activeMembers: number; staffCount: number; pendingInvitations: number; campaigns: number | null; events: number | null; donatedAmount: number | null };
  pendingLegalChange: string | null;
};
export type PageResult<T> = { items: T[]; totalCount: number; page: number; pageSize: number };
export type Member = { id: string; userId: string; fullName: string; email: string | null; roles: string[]; isActive: boolean; accountActive: boolean; joinedAt: string; version: string };
export type Invitation = { id: string; organizationId: string; organizationName: string; rolesJson: string; roles: string[]; fullName: string; email: string; state: string; expiresAt: string; version: string };
export const labelsForRoles = (roles: string[]) => roles.map(r => memberRoles[r] || r).join(" · ");
