"use client";
import { useWorkspace } from "@/components/OrganizationWorkspaceShell";
import WorkspaceSummary from "@/components/WorkspaceSummary";
export default function Page() { const {data}=useWorkspace(); return <WorkspaceSummary data={data}/>; }
