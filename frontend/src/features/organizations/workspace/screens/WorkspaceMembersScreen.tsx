"use client";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import WorkspaceMembers from "@/features/organizations/workspace/components/WorkspaceMembers";
export default function WorkspaceMembersScreen() {
  const { data, reload } = useWorkspace();
  return (
    <WorkspaceMembers
      id={data.id}
      canManage={data.canManageMembers}
      inviteRoles={data.invitableRoles}
      organizationName={data.profile.displayName}
      ownerStats={data.statistics}
      onChange={reload}
      heading="h1"
    />
  );
}
