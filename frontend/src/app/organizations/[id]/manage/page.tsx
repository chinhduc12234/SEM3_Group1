"use client";
import { useWorkspace } from "@/features/organizations/components/OrganizationWorkspaceShell";
import WorkspaceSummary from "@/features/organizations/components/WorkspaceSummary";
export default function Page() { const {data}=useWorkspace(); return <WorkspaceSummary data={data}/>; }
