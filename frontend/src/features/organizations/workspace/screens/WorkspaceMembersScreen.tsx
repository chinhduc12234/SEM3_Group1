"use client";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import WorkspaceMembers from "@/features/organizations/workspace/components/WorkspaceMembers";
export default function WorkspaceMembersScreen() {
  const { data, reload } = useWorkspace();
  return (
    <LocalizedTree>
      <>
        <p className="eyebrow">CÙNG NHAU VẬN HÀNH</p>
        <h1>Nhân sự & vai trò</h1>
        <WorkspaceMembers
          id={data.id}
          canManage={data.canManageMembers}
          inviteRoles={data.invitableRoles}
          onChange={reload}
        />
      </>
    </LocalizedTree>
  );
}
