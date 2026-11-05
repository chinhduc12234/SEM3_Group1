import AdminShell from "@/features/dashboard/components/AdminShell";
import "@/app/workspace.css";
export default function Layout({children}:{children:React.ReactNode}){return <AdminShell>{children}</AdminShell>;}
