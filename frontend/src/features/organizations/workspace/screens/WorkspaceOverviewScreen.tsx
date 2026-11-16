"use client";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import WorkspaceSummary from "@/features/organizations/workspace/components/WorkspaceSummary";
export default function WorkspaceOverviewScreen() {
  const { data } = useWorkspace();
  return <WorkspaceSummary data={data} />;
}
