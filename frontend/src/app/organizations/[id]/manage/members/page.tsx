"use client";
import { useWorkspace } from "@/features/organizations/components/OrganizationWorkspaceShell";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";
import WorkspaceMembers from "@/features/organizations/components/WorkspaceMembers";
export default function Page(){const {data,reload}=useWorkspace();return <LocalizedTree><><p className="eyebrow">CÙNG NHAU VẬN HÀNH</p><h1>Nhân sự & vai trò</h1><WorkspaceMembers id={data.id} canManage={data.canManageMembers} inviteRoles={data.invitableRoles} onChange={reload}/></></LocalizedTree>;}
