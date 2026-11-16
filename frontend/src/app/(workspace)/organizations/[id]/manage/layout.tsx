import OrganizationWorkspaceShell from "@/features/organizations/workspace/components/OrganizationWorkspaceShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ga-site ga-user">
      <OrganizationWorkspaceShell>{children}</OrganizationWorkspaceShell>
    </div>
  );
}
