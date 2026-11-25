"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace } from "../WorkspaceContext";
import { api } from "@/shared/api/api";
import { ProgressTrack, StatusPill } from "@/shared/ui/StatusVisuals";
import type { PageResult } from "@/shared/api/pagination";
import { campaignStatuses } from "@/features/campaigns/types/campaigns";
import type { CampaignRow } from "@/features/campaigns/management/campaignManagement";
import styles from "../Workspace.module.css";

const queues = [
  { name: "Duyệt ý tưởng", role: "OWNER", status: "PENDING_CONCEPT_APPROVAL", path: "campaigns" },
  { name: "Duyệt kế hoạch cuối", role: "OWNER", status: "PENDING_FINAL_REVIEW", path: "campaigns" },
  { name: "Chờ công bố", role: "OWNER", status: "FINAL_APPROVED", path: "campaigns" },
  { name: "Kế hoạch được phân công", role: "CAMPAIGN_MANAGER", status: "PLANNING", path: "campaigns" },
  { name: "Chiến dịch đã công bố", role: "CAMPAIGN_MANAGER", status: "PUBLISHED", path: "campaigns" },
  { name: "Chuẩn bị vận hành", role: "VOLUNTEER_COORDINATOR", status: "PLANNING", path: "operations" },
  { name: "Điều phối tình nguyện", role: "VOLUNTEER_COORDINATOR", status: "PUBLISHED", path: "operations", tab: "volunteers" },
  { name: "Chuẩn bị ngân sách", role: "FINANCE_MANAGER", status: "PLANNING", path: "budget" },
  { name: "Ủng hộ và tiếp nhận", role: "FINANCE_MANAGER", status: "PUBLISHED", path: "budget", tab: "donations" },
  { name: "Theo dõi trước khi bắt đầu", role: "OWNER", status: "PUBLISHED", path: "campaigns" },
] as const;

export default function WorkspaceWorkScreen() {
  const { id } = useParams<{ id: string }>();
  const { data } = useWorkspace();
  const allowed = queues.filter((queue) => data.roles.includes(queue.role));
  const [name, setName] = useState(allowed[0]?.name);
  const queue = allowed.find((item) => item.name === name) ?? allowed[0];
  const [page, setPage] = useState(1);
  const [output, setOutput] = useState<PageResult<CampaignRow>>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const root = `/organizations/${id}/manage`;

  useEffect(() => {
    if (!queue) return;
    const controller = new AbortController();
    setOutput(undefined);
    setError("");
    const query = new URLSearchParams({ status: queue.status, page: String(page), pageSize: "15" });
    if (queue.role !== "OWNER") query.set("assignedRole", queue.role);
    api<PageResult<CampaignRow>>(`/api/campaigns/organization/${id}?${query}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setOutput(result); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [id, queue, page, revision]);

  return <div className={styles.ownerDashboard}>
    <header className={styles.ownerWelcome}><div className={styles.ownerWelcomeCopy}>
      <h1>Việc của tôi</h1>
    </div></header>
    {!queue ? <p className="notice">Vai trò hiện tại không có hàng đợi chiến dịch. <Link href={root + "/members"}>Mở danh bạ nội bộ</Link></p>
      : <section className={styles.ownerPanel}>
        <nav className={styles.workFilters} aria-label="Loại công việc">{allowed.map((item) =>
          <button type="button" key={item.name} aria-pressed={queue.name === item.name} onClick={() => {
            setName(item.name); setPage(1);
          }}>{item.name}</button>)}</nav>
        <header className={styles.workListHeading}>
          <h2>{queue.name}</h2>
          {output && <StatusPill tone={output.totalCount ? "info" : "neutral"}>{output.totalCount} hồ sơ</StatusPill>}
        </header>
        {error && <p className="notice error" role="alert">{error} <button onClick={() => setRevision((value) => value + 1)}>Tải lại</button></p>}
        {!error && !output && <p role="status">Đang tải công việc…</p>}
        {output && output.items.length === 0 && <p className={styles.workEmpty}>Chưa có hồ sơ trong hàng đợi này.</p>}
        <div className={styles.workCards}>{output?.items.map((row) => {
          const details = `${root}/${queue.path}/${row.id}${"tab" in queue ? "?tab=" + queue.tab : ""}`;
          const completed = Number(!!row.operationsConfirmedAt) + Number(!!row.budgetConfirmedAt && !row.budgetNeedsReview);
          return <article key={row.id} className={styles.workCard}>
            <div className={styles.workCardMeta}>
              <StatusPill tone={row.status === "PUBLISHED" ? "positive" : row.status === "PLANNING" ? "info" : "warning"}>{campaignStatuses[row.status] ?? row.status}</StatusPill>
              {row.startDate && <time dateTime={row.startDate}>{new Date(row.startDate + "T00:00:00Z").toLocaleDateString("vi-VN", { timeZone: "UTC" })}</time>}
            </div>
            <h3><Link href={details}>{row.title}</Link></h3>
            {row.status === "PLANNING" && <div>
              <ProgressTrack limit={2} segments={[{ value: completed, tone: "positive" }]}
                label={`${completed} trên 2 phần kế hoạch đã xác nhận`} />
              <small>{completed}/2 phần kế hoạch đã xác nhận</small>
            </div>}
            {queue.path === "campaigns" && row.status === "PUBLISHED" && !row.legacyPublished &&
              <Link href={`${root}/campaigns/${row.id}/readiness`}>Xem mức sẵn sàng <span aria-hidden="true">↗</span></Link>}
          </article>;
        })}</div>
        {output && output.totalCount > output.pageSize && <nav className={styles.workFilters} aria-label="Phân trang công việc">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button>
          <span>Trang {page}</span>
          <button disabled={page * output.pageSize >= output.totalCount} onClick={() => setPage(page + 1)}>Trang sau</button>
        </nav>}
      </section>}
  </div>;
}
