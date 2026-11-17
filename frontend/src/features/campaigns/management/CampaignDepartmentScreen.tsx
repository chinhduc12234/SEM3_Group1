"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import type { PageResult } from "@/shared/api/pagination";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { campaignTypes, type Campaign } from "../types/campaigns";
import { formatCampaignDate } from "../formatCampaignDate";
import type { CampaignRow } from "./campaignManagement";
import CampaignOperationsPanel from "./components/CampaignOperationsPanel";
import CampaignBudgetPanel from "./budget/CampaignBudgetPanel";
import { BudgetStatus } from "./budget/CampaignBudgetSummary";
import OperationsStatusBadge from "./components/OperationsStatusBadge";
import styles from "./CampaignManagement.module.css";

const departments = {
  operations: { role: "VOLUNTEER_COORDINATOR", title: "Vận hành", roleLabel: "Quản lý vận hành", list: "Danh sách vận hành" },
  budget: { role: "FINANCE_MANAGER", title: "Ngân sách", roleLabel: "Quản lý tài chính", list: "Danh sách ngân sách" },
} as const;

export default function CampaignDepartmentScreen({ workspace = "operations" }: { workspace?: keyof typeof departments }) {
  const { id, campaignId } = useParams<{ id: string; campaignId?: string }>();
  const { data } = useWorkspace();
  const { user } = useAuth();
  const actorId = user?.id;
  const department = departments[workspace];
  const canOpen = data.roles.includes(department.role);
  const root = `/organizations/${id}/manage`;
  const workspacePath = `${root}/${workspace}`;
  const [campaign, setCampaign] = useState<Campaign>();
  const [list, setList] = useState<PageResult<CampaignRow>>();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("PLANNING");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!canOpen) return;
    const controller = new AbortController();
    setError("");
    const signal = controller.signal;
    if (campaignId) {
      setCampaign(undefined);
      api<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}/manage`, { signal }).then((result) => {
        if (signal.aborted) return;
        if (result.organizationId !== id) throw new Error("Hồ sơ không thuộc tổ chức này.");
        const canOpenRecord = result.status === "PLANNING" ||
          (result.status === "PUBLISHED" && !!result.finalSubmissionId);
        if (!canOpenRecord || !result.assignments.some((assignment) =>
          assignment.userId === actorId && assignment.role === department.role))
          throw new Error("Bạn chưa được phân công phụ trách phần này của hồ sơ.");
        setCampaign(result);
      }).catch((e: Error) => { if (!signal.aborted) setError(e.message); });
    } else {
      setList(undefined);
      const query = new URLSearchParams({ status, assignedRole: department.role, page: String(page), pageSize: "10" });
      api<PageResult<CampaignRow>>(`/api/campaigns/organization/${id}?${query}`, { signal }).then((result) => {
        if (!signal.aborted) setList(result);
      }).catch((e: Error) => { if (!signal.aborted) setError(e.message); });
    }
    return () => controller.abort();
  }, [id, campaignId, canOpen, actorId, department, page, status, workspace, retry]);

  if (!canOpen) return <LocalizedTree>
    <p className="notice">Bạn cần quyền {department.roleLabel} để mở mục này.</p>
  </LocalizedTree>;

  return <LocalizedTree>
    {campaignId && <Link href={workspacePath}>← {department.list}</Link>}
    <h1>{campaign?.title || department.title}</h1>
    {!campaignId && <label>Trạng thái hồ sơ
      <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
        <option value="PLANNING">Đang lập kế hoạch</option>
        <option value="PUBLISHED">Đã công bố</option>
      </select>
    </label>}
    {error && <p className="notice error" role="alert">{error} <button type="button" className="quiet" onClick={() => setRetry(retry + 1)}>Tải lại</button></p>}
    {!list && !campaign && !error && <p role="status">Đang tải hồ sơ…</p>}
    {campaign && <>
      <p className="muted">{campaignTypes[campaign.campaignType]} · <Link href={`${root}/campaigns/${campaign.id}`}>Xem hồ sơ đã duyệt</Link></p>
      {workspace === "budget" ? <CampaignBudgetPanel key={campaign.id} campaign={campaign} /> :
        <CampaignOperationsPanel key={campaign.id} campaign={campaign} />}
    </>}
    {list && <section className="panel">
      <h2>Kế hoạch theo chiến dịch và sự kiện</h2>
      {!list.items.length && <p>Chưa có hồ sơ ở trạng thái này.</p>}
      {list.items.length > 0 && <ul className={styles.operationsList}>
        {list.items.map((row) => <li key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <p className="muted">{campaignTypes[row.campaignType]}{row.startDate && row.endDate &&
              ` · ${formatCampaignDate(row.startDate)} – ${formatCampaignDate(row.endDate)}`}</p>
            <div className={styles.operationsRowStatus}>
              {workspace === "budget" ? <BudgetStatus confirmedAt={row.budgetConfirmedAt} needsReview={row.budgetNeedsReview} /> :
                <OperationsStatusBadge confirmedAt={row.operationsConfirmedAt} />}
            </div>
          </div>
          <Link className="button secondary" href={`${workspacePath}/${row.id}`}>{workspace === "budget" ? "Mở dự toán" : "Mở kế hoạch"}</Link>
        </li>)}
      </ul>}
      {list.totalCount > list.pageSize && <div className="actions">
        <button type="button" className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button>
        <span>Trang {page}</span>
        <button type="button" className="secondary" disabled={page * list.pageSize >= list.totalCount} onClick={() => setPage(page + 1)}>Sau</button>
      </div>}
    </section>}
  </LocalizedTree>;
}
