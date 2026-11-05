"use client";
import { useWorkspace } from "@/features/organizations/components/OrganizationWorkspaceShell";
import OrganizationLegalChanges from "@/features/organizations/components/OrganizationLegalChanges";
export default function Page(){const {data}=useWorkspace();if(!data.canManageMembers)return <p className="notice">Chỉ OWNER được quản lý hồ sơ pháp lý.</p>;return <><p className="eyebrow">MINH BẠCH & XÁC THỰC</p><h1>Hồ sơ pháp lý</h1><OrganizationLegalChanges id={data.id} canRequest/></>;}
