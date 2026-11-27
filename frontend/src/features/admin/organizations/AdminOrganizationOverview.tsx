"use client";
import adminStyles from "@/features/admin/Admin.module.css";
import workspaceStyles from "@/features/organizations/workspace/Workspace.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/shared/api/api";
type Overview = {
  activeOrganizations: number;
  activeMemberships: number;
  uniquePeople: number;
  pendingLegalChanges: number;
};
export default function AdminOrganizationOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Overview>("/api/organizations/admin/overview")
      .then(setData)
      .catch((ex) => setError(ex.message));
  }, []);
  return (
    <LocalizedTree>
      <section className={adminStyles.panel} style={{ marginBottom: 24 }}>
        <div className={adminStyles.panelHeading}>
          <div>
            <p className={adminStyles.eyebrow}>GIÁM SÁT TỔ CHỨC</p>
            <h2>Tổ chức đang vận hành</h2>
          </div>
          <Link className={adminStyles.inlineLink} href="/admin/organization-directory">
            Xem danh bạ tổ chức →
          </Link>
        </div>
        <div className={workspaceStyles.metrics}>
          {[
            ["Tổ chức hoạt động", data?.activeOrganizations],
            ["Lượt thành viên hoạt động", data?.activeMemberships],
            ["Số người riêng biệt", data?.uniquePeople],
            ["Thay đổi pháp lý chờ duyệt", data?.pendingLegalChanges],
          ].map(([label, value]) => (
            <div key={label} className="panel">
              <span className="muted">{label}</span>
              <strong>{value ?? "—"}</strong>
            </div>
          ))}
        </div>
        {error && <p className="notice error">{error}</p>}
      </section>
    </LocalizedTree>
  );
}
