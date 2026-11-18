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
import finance from "./budget/BudgetDashboard.module.css";
import { BudgetHero, BudgetRecordCard } from "./budget/BudgetDashboard";
import ops from "./components/OperationsDashboard.module.css";
import { OperationsCards, OperationsCard, OperationsHero } from "./components/OperationsDashboard";

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

  if (workspace === "operations") return <LocalizedTree>
    <div className={ops.dashboard}>
      {campaignId && <Link className={ops.back} href={workspacePath}>← Danh sách vận hành</Link>}
      <OperationsHero title={campaign?.title ?? "Vận hành"}
        description={campaign ? "Điều phối lịch, nhân sự và cập nhật hoạt động cho Owner." : "Theo dõi các chiến dịch và sự kiện bạn được phân công phụ trách."}>
        {campaign && <Link className={ops.heroLink} href={`${root}/campaigns/${campaign.id}`}>Xem hồ sơ đã duyệt ↗</Link>}
      </OperationsHero>
      {error && <p className="notice error" role="alert">{error} <button type="button" className="quiet"
        onClick={() => setRetry((value) => value + 1)}>Tải lại</button></p>}
      {campaignId ? campaign ? <CampaignOperationsPanel key={campaign.id} campaign={campaign} /> :
        !error && <p role="status">Đang tải hồ sơ…</p> :
        <section className={ops.surface}>
          <div className={ops.listHeader}>
            <div><h2>Kế hoạch được phân công</h2>
              {list && <p className="muted">{list.totalCount} hồ sơ</p>}</div>
            <label>Trạng thái hồ sơ
              <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="PLANNING">Đang lập kế hoạch</option>
                <option value="PUBLISHED">Đã công bố</option>
              </select>
            </label>
          </div>
          {!list && !error && <p role="status" className={ops.empty}>Đang tải hồ sơ…</p>}
          {list?.items.length === 0 && <p className={ops.empty}>Chưa có hồ sơ được phân công ở trạng thái này.</p>}
          {!!list?.items.length && <OperationsCards>{list.items.map((row) =>
            <OperationsCard key={row.id} title={row.title} href={`${workspacePath}/${row.id}`}
              subtitle={[campaignTypes[row.campaignType], row.startDate && row.endDate &&
                `${formatCampaignDate(row.startDate)} – ${formatCampaignDate(row.endDate)}`].filter(Boolean).join(" · ")}
              status={<OperationsStatusBadge confirmedAt={row.operationsConfirmedAt} />} />)}
          </OperationsCards>}
          {list && list.totalCount > list.pageSize && <div className={ops.actions}>
            <button type="button" className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button>
            <span>Trang {page}</span>
            <button type="button" className="secondary" disabled={page * list.pageSize >= list.totalCount} onClick={() => setPage(page + 1)}>Sau</button>
          </div>}
        </section>}
    </div>
  </LocalizedTree>;

  return <LocalizedTree>
    <div className={finance.dashboard}>
      <BudgetHero title={campaign?.title ?? "Ngân sách"}
        description={campaign ? campaignTypes[campaign.campaignType] : "Lập dự toán, theo dõi nguồn vốn và ghi nhận chi thực tế cho các hồ sơ được phân công."}
        backHref={campaignId ? workspacePath : undefined}>
        {campaign && <Link className={finance.heroLink} href={`${root}/campaigns/${campaign.id}`}>Xem hồ sơ đã duyệt <span aria-hidden="true">↗</span></Link>}
      </BudgetHero>
      {error && <p className="notice error" role="alert">{error} <button type="button" className="quiet" onClick={() => setRetry(retry + 1)}>Tải lại</button></p>}
      {campaignId ? campaign ? <CampaignBudgetPanel key={campaign.id} campaign={campaign} /> :
        !error && <p className={finance.empty} role="status">Đang tải hồ sơ…</p> :
        <section className={finance.surface} aria-labelledby="assigned-budgets">
          <header className={finance.sectionHeader}>
            <div><h2 id="assigned-budgets">Ngân sách được phân công</h2>
              {list && <p role="status">{list.totalCount} hồ sơ</p>}</div>
            <label>Trạng thái hồ sơ
              <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="PLANNING">Đang lập kế hoạch</option>
                <option value="PUBLISHED">Đã công bố</option>
              </select>
            </label>
          </header>
          {!list && !error && <p className={finance.empty} role="status">Đang tải hồ sơ…</p>}
          {list?.items.length === 0 && <p className={finance.empty}>Chưa có hồ sơ được phân công ở trạng thái này.</p>}
          {!!list?.items.length && <ul className={finance.records}>
            {list.items.map((row) => <BudgetRecordCard key={row.id} title={row.title}
              href={`${workspacePath}/${row.id}`}
              metadata={[campaignTypes[row.campaignType], row.startDate && row.endDate &&
                `${formatCampaignDate(row.startDate)} – ${formatCampaignDate(row.endDate)}`].filter(Boolean).join(" · ")}
              status={<BudgetStatus confirmedAt={row.budgetConfirmedAt} needsReview={row.budgetNeedsReview} />} />)}
          </ul>}
          {list && list.totalCount > list.pageSize && <div className={finance.actions}>
            <button type="button" className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button>
            <span>Trang {page}</span>
            <button type="button" className="secondary" disabled={page * list.pageSize >= list.totalCount} onClick={() => setPage(page + 1)}>Sau</button>
          </div>}
        </section>}
    </div>
  </LocalizedTree>;
}
