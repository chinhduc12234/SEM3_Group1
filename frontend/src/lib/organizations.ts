export type Profile = {
  legalName: string; organizationType: string; registrationNumber: string; registrationDate: string; registrationAuthority: string;
  foundedDate: string; taxCode: string; address: string; province: string; contactEmail: string; contactPhone: string; website: string; mission: string;
  representativeName: string; representativeTitle: string; representativeBirthDate: string; representativeEmail: string; representativePhone: string;
  identityType: string; identityIssuedDate: string; identityIssuedBy: string;
};
export type Organization = { id: string; profile: Profile; identityNumber: string; status: string; consent: boolean; version: string;
  createdAt: string; submittedAt: string | null; applicantUserId: string;
  documents: { id: string; kind: string; fileName: string; size: number; uploadedAt: string }[];
  history: { action: string; reason: string; at: string; actorUserId: string }[];
};
export const statuses: Record<string, string> = { DRAFT: "Bản nháp", PENDING_REVIEW: "Chờ xét duyệt", ACTIVE: "Đã phê duyệt", REJECTED: "Đã từ chối", CHANGES_REQUESTED: "Cần bổ sung" };
export const documentKinds: Record<string, string> = { REGISTRATION: "Giấy chứng nhận đăng ký / quyết định thành lập", REPRESENTATIVE_ID: "Giấy tờ định danh người đại diện", AUTHORIZATION: "Văn bản chứng minh quyền đại diện / ủy quyền" };
export const fields: { key: keyof Profile; label: string; type?: string; max?: number; min?: number; group: string; optional?: boolean }[] = [
  { key: "legalName", label: "Tên pháp lý đầy đủ", min: 3, max: 200, group: "Thông tin pháp lý" },
  { key: "registrationNumber", label: "Số giấy đăng ký / quyết định thành lập", min: 3, max: 80, group: "Thông tin pháp lý" },
  { key: "registrationDate", label: "Ngày cấp giấy đăng ký", type: "date", group: "Thông tin pháp lý" },
  { key: "registrationAuthority", label: "Cơ quan cấp", min: 3, max: 200, group: "Thông tin pháp lý" },
  { key: "foundedDate", label: "Ngày thành lập", type: "date", group: "Thông tin pháp lý" },
  { key: "taxCode", label: "Mã số thuế (nếu có)", max: 30, optional: true, group: "Thông tin pháp lý" },
  { key: "address", label: "Địa chỉ trụ sở", min: 10, max: 400, group: "Liên hệ và hoạt động" },
  { key: "province", label: "Tỉnh / thành phố", min: 2, max: 100, group: "Liên hệ và hoạt động" },
  { key: "contactEmail", label: "Email tổ chức", type: "email", max: 256, group: "Liên hệ và hoạt động" },
  { key: "contactPhone", label: "Số điện thoại tổ chức", type: "tel", max: 25, group: "Liên hệ và hoạt động" },
  { key: "website", label: "Website (nếu có)", type: "url", max: 300, optional: true, group: "Liên hệ và hoạt động" },
  { key: "mission", label: "Mục tiêu và phạm vi hoạt động", type: "textarea", min: 30, max: 4000, group: "Liên hệ và hoạt động" },
  { key: "representativeName", label: "Họ tên người đại diện", min: 2, max: 200, group: "Người đại diện" },
  { key: "representativeTitle", label: "Chức vụ", min: 2, max: 100, group: "Người đại diện" },
  { key: "representativeBirthDate", label: "Ngày sinh (đủ 18 tuổi)", type: "date", group: "Người đại diện" },
  { key: "representativeEmail", label: "Email người đại diện", type: "email", max: 256, group: "Người đại diện" },
  { key: "representativePhone", label: "Điện thoại người đại diện", type: "tel", max: 25, group: "Người đại diện" },
  { key: "identityIssuedDate", label: "Ngày cấp giấy tờ định danh", type: "date", group: "Người đại diện" },
  { key: "identityIssuedBy", label: "Nơi cấp giấy tờ định danh", min: 2, max: 200, group: "Người đại diện" },
];
export const emptyProfile = Object.fromEntries([...fields.map(f => [f.key, ""]), ["organizationType", "NGO"], ["identityType", "CCCD"]]) as Profile;
export function Status({ status }: { status: string }) { return statuses[status] || status; }
