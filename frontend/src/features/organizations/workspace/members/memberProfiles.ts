import type { Member } from "@/features/organizations/types/workspace";

export type Personnel = { fullName: string; phone: string; identityNumber: string; photo: string };
export type ProfileResult = { [K in keyof Personnel]: string | null } & {
  roles: string[];
  version: string;
  email: string | null;
  userId: string | null;
  isActive: boolean;
  accountActive: boolean;
};
export type Editor = { kind: "create" } | { kind: "edit"; member: Member; profile: ProfileResult };
export type Detail = { member: Member; profile: ProfileResult };
