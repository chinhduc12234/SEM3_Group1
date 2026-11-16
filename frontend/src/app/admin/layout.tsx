import AdminShell from "@/features/admin/components/AdminShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ga-site">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
