import type { ReactNode } from "react";

export default function DashboardFrame({ children }: { children: ReactNode }) {
  return <main className="container ga-dashboard">{children}</main>;
}
