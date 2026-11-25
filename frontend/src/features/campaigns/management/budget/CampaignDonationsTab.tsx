"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, downloadDocument } from "@/shared/api/api";
import { ProgressTrack, StatusPill } from "@/shared/ui/StatusVisuals";
import { GoodsProgress, MoneyProgress, type MoneyTarget as Target, type GoodsTarget as InKindTarget } from "../../components/FundraisingProgress";
import InKindReceiptForm from "./InKindReceiptForm";
import css from "./CampaignDonationsTab.module.css";

type Donation = { id: string; donorName: string; donorEmail: string; targetName: string; payerAccountLast4: string | null; amount: number; status: string; reference: string; createdAt: string; confirmedAt: string | null };
type Pledge = { id: string; budgetItemId: string; donorName: string; donorEmail: string; targetName: string; quantity: number; receivedQuantity: number; unit: string; note: string | null; status: string; createdAt: string; reviewedAt: string | null; completedAt: string | null; scheduledAt?: string | null };
type ManagerView = { summary: { targetAmount: number; donatedAmount: number; remainingAmount: number; confirmedDonationCount: number; targets: Target[]; inKindTargets: InKindTarget[]; isClosed: boolean }; pendingCount: number; donations: Donation[]; page: number; totalCount: number };
const donationStatuses: Record<string, string> = { CONFIRMED: "Đã xác nhận OTP", OTP_PENDING: "Chờ OTP", PENDING: "Chờ thanh toán", EXPIRED: "Hết hạn" };
const pledgeStatuses: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Chờ giao", RECEIVED: "Đã nhận đủ", REJECTED: "Từ chối", CANCELLED: "Đã hủy", EXPIRED: "Hết hạn" };
type InKindView = { targets: InKindTarget[]; pledges: Pledge[] };
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const time = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const PAGE_SIZE = 5;

function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return <nav className={css.pagination} aria-label="Phân trang danh sách">
    <span>{first}–{last} / {total}</span>
    <div>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>← Trước</button>
      <strong>Trang {page} / {pages}</strong>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>Sau →</button>
    </div>
  </nav>;
}

export default function CampaignDonationsTab({ campaignId }: { campaignId: string }) {
  const [view, setView] = useState<ManagerView>();
  const [inKind, setInKind] = useState<InKindView>();
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState("");
  const receiptAttempts = useRef(new Map<string, { quantity: number; requestId: string }>());
  const [activeTab, setActiveTab] = useState<"money" | "in-kind">("money");
  const [exporting, setExporting] = useState(false);
  const [donationPage, setDonationPage] = useState(1);
  const [inKindPage, setInKindPage] = useState(1);
  const [moneyFilters, setMoneyFilters] = useState({ status: "", reference: "", budgetItemId: "" });
  const load = useCallback(async (signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(donationPage), pageSize: String(PAGE_SIZE) });
    for (const [key, value] of Object.entries(moneyFilters)) if (value) query.set(key, value);
    const [moneyView, goodsView] = await Promise.all([
      api<ManagerView>(`/api/donations/manager/campaigns/${campaignId}?${query}`, { signal }),
      api<InKindView>(`/api/donations/manager/campaigns/${campaignId}/in-kind`, { signal }),
    ]);
    return { moneyView, goodsView };
  }, [campaignId, donationPage, moneyFilters]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((result) => { if (!controller.signal.aborted) { setView(result.moneyView); setInKind(result.goodsView); setError(""); } })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [load, retry]);

  if (error) return <p className={css.empty} role="alert">{error} <button type="button" className="quiet" onClick={() => setRetry((n) => n + 1)}>Tải lại</button></p>;
  if (!view) return <p role="status" className={css.empty}>Đang tải khoản ủng hộ…</p>;
  const { summary } = view;
  const pledges = inKind?.pledges ?? [];
  const donationPages = Math.max(1, Math.ceil(view.totalCount / PAGE_SIZE));
  const pledgePages = Math.max(1, Math.ceil(pledges.length / PAGE_SIZE));
  const activeInKindPage = Math.min(inKindPage, pledgePages);
  const visiblePledges = pledges.slice((activeInKindPage - 1) * PAGE_SIZE, activeInKindPage * PAGE_SIZE);
  async function reviewPledge(id: string, decision: "APPROVE" | "REJECT") {
    setActing(id); setActionError("");
    try {
      await api(`/api/donations/in-kind/${id}/review`, { method: "POST", body: JSON.stringify({ decision }) });
      setRetry((n) => n + 1);
    } catch (failure) { setActionError((failure as Error).message); }
    finally { setActing(""); }
  }

  async function exportConfirmed() {
    setExporting(true);
    setActionError("");
    try { await downloadDocument(`/api/donations/manager/campaigns/${campaignId}/disclosure.csv`, "ke-khai-ung-ho-sandbox.csv"); }
    catch (failure) { setActionError((failure as Error).message); }
    finally { setExporting(false); }
  }
  async function receivePledge(id: string) {
    const quantity = Number(receiveQuantities[id]);
    const previous = receiptAttempts.current.get(id);
    const attempt = previous?.quantity === quantity ? previous : { quantity, requestId: crypto.randomUUID() };
    receiptAttempts.current.set(id, attempt);
    setActing(id); setActionError("");
    try {
      await api(`/api/donations/in-kind/${id}/receive`, { method: "POST", body: JSON.stringify(attempt) });
      receiptAttempts.current.delete(id);
      setReceiveQuantities((current) => ({ ...current, [id]: "" }));
      setRetry((n) => n + 1);
    } catch (failure) { setActionError((failure as Error).message); }
    finally { setActing(""); }
  }
  return <section className={css.wrap} aria-labelledby="donations-manager-title">
    <header><h3 id="donations-manager-title">Quản lý ủng hộ chiến dịch</h3></header>
    <div className={css.tabs} role="tablist" aria-label="Loại ủng hộ cần quản lý">
      <button id="donation-tab-money" type="button" role="tab" aria-selected={activeTab === "money"} aria-controls="donation-panel-money"
        className={activeTab === "money" ? css.activeTab : ""} onClick={() => setActiveTab("money")}>
        Tiền ủng hộ
      </button>
      <button id="donation-tab-in-kind" type="button" role="tab" aria-selected={activeTab === "in-kind"} aria-controls="donation-panel-in-kind"
        className={activeTab === "in-kind" ? css.activeTab : ""} onClick={() => setActiveTab("in-kind")}>
        Hiện vật <span>{pledges.length}</span>
      </button>
    </div>
    {activeTab === "money" && <div id="donation-panel-money" role="tabpanel" aria-labelledby="donation-tab-money" className={css.tabPanel}>
      <MoneyProgress summary={summary} pendingCount={view.pendingCount} />
      <section aria-labelledby="donor-list-title">
        <h4 id="donor-list-title">Danh sách giao dịch mô phỏng</h4>
        <form className={css.filters} onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          setDonationPage(1);
          setMoneyFilters({ status: String(values.get("status") ?? ""), reference: String(values.get("reference") ?? "").trim(),
            budgetItemId: String(values.get("budgetItemId") ?? "") });
        }}>
          <label>Trạng thái<select name="status" defaultValue={moneyFilters.status}><option value="">Tất cả</option>
            {Object.entries(donationStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Hạng mục<select name="budgetItemId" defaultValue={moneyFilters.budgetItemId}><option value="">Tất cả</option>
            {summary.targets.map((target) => <option key={target.budgetItemId} value={target.budgetItemId}>{target.name}</option>)}
          </select></label>
          <label>Mã tham chiếu<input name="reference" maxLength={40} defaultValue={moneyFilters.reference} /></label>
          <button type="submit">Lọc giao dịch</button>
        </form>
        {!view.donations.length ? <p className={css.empty}>Chưa có giao dịch phù hợp.</p> : <div className={css.tableWrap}>
          <table className={css.table}><thead><tr><th>Người ủng hộ</th><th>Ủng hộ cho</th><th>Số tiền</th><th>Tài khoản thử nghiệm</th><th>Trạng thái</th><th>Thời gian</th></tr></thead>
            <tbody>{view.donations.map((row) => <tr key={row.id}>
              <td>{row.donorName}<small>{row.donorEmail}</small><small>{row.reference}</small></td>
              <td>{row.targetName}</td><td>{money(row.amount)}</td><td>{row.payerAccountLast4 ? `•••• ${row.payerAccountLast4}` : "Chưa nhập"}</td>
              <td><StatusPill tone={row.status === "CONFIRMED" ? "positive" : row.status === "EXPIRED" ? "neutral" : "warning"}>{donationStatuses[row.status] ?? row.status}</StatusPill></td>
              <td>{time(row.confirmedAt ?? row.createdAt)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <Pagination page={view.page} pages={donationPages} total={view.totalCount} onChange={setDonationPage} />
      </section>
      {actionError && <p role="alert">{actionError}</p>}
      <button type="button" disabled={exporting} onClick={() => void exportConfirmed()}>
        {exporting ? "Đang xuất kê khai…" : "Tải CSV giao dịch đã xác nhận"}
      </button>
      <p className="muted">Đây là số liệu môi trường thử nghiệm; không đại diện cho tiền thật đã vào tài khoản.</p>
    </div>}
    {activeTab === "in-kind" && <div id="donation-panel-in-kind" role="tabpanel" aria-labelledby="donation-tab-in-kind" className={css.tabPanel}>
      {actionError && <p role="alert">{actionError}</p>}
      {inKind && <GoodsProgress targets={inKind.targets} />}
      {!!inKind?.targets.length && <InKindReceiptForm campaignId={campaignId} targets={inKind.targets} onReceived={() => setRetry(value => value + 1)} />}
      <section aria-labelledby="in-kind-review-title">
        <h4 id="in-kind-review-title">Đề nghị tặng hiện vật</h4>
        {!pledges.length ? <p className={css.empty}>Chưa có đề nghị tặng hiện vật.</p> : <div className={css.tableWrap}>
          <table className={css.table}><thead><tr><th>Người tặng</th><th>Hiện vật</th><th>Ghi chú</th><th>Đã nhận</th><th>Trạng thái / thao tác</th></tr></thead>
            <tbody>{visiblePledges.map((row) => <tr key={row.id}>
              <td>{row.donorName}<small>{row.donorEmail}</small></td><td>{row.quantity} {row.unit} · {row.targetName}</td>
              <td>{row.note || "—"}</td><td>{row.receivedQuantity} / {row.quantity} {row.unit}
                <ProgressTrack limit={row.quantity} segments={[{ value: row.receivedQuantity, tone: "positive" }]}
                  label={`Đã thực nhận ${row.receivedQuantity} trên ${row.quantity} ${row.unit}`} /></td>
              <td><StatusPill tone={row.status === "RECEIVED" ? "positive" : row.status === "APPROVED" ? "info" : row.status === "PENDING" ? "warning" : "neutral"}>
                {pledgeStatuses[row.status] ?? row.status}
              </StatusPill>
                {row.scheduledAt && <small>{time(row.scheduledAt)} · {row.id}</small>}
                {row.status === "PENDING" && <div className={css.rowActions}>
                  <button type="button" className={css.approveButton} disabled={!!acting} onClick={() => void reviewPledge(row.id, "APPROVE")}><span aria-hidden="true">✓</span> Duyệt</button>
                  <button type="button" className={css.rejectButton} disabled={!!acting} onClick={() => void reviewPledge(row.id, "REJECT")}><span aria-hidden="true">×</span> Từ chối</button>
                </div>}
                {row.status === "APPROVED" && <div className={css.rowActions}>
                  <input aria-label={`Số lượng thực nhận ${row.targetName}`} type="number" min="0" max={row.quantity - row.receivedQuantity} step="0.01" value={receiveQuantities[row.id] ?? "0"} onChange={(event) => setReceiveQuantities((current) => ({ ...current, [row.id]: event.target.value }))} />
                  <button type="button" className={css.receiveButton} disabled={!!acting || Number(receiveQuantities[row.id] ?? 0) <= 0 || Number(receiveQuantities[row.id]) > row.quantity - row.receivedQuantity} onClick={() => void receivePledge(row.id)}><span aria-hidden="true">↓</span> Ghi nhận nhận hàng</button>
                </div>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>}
        <Pagination page={activeInKindPage} pages={pledgePages} total={pledges.length} onChange={setInKindPage} />
      </section>
    </div>}
  </section>;
}
