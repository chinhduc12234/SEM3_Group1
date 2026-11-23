"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import css from "./CampaignDonationsTab.module.css";

type Target = { budgetItemId: string; name: string; targetAmount: number; donatedAmount: number; remainingAmount: number; isComplete: boolean };
type Donation = { id: string; donorName: string; donorEmail: string; targetName: string; payerAccountLast4: string | null; amount: number; status: string; reference: string; createdAt: string; confirmedAt: string | null };
type InKindTarget = { budgetItemId: string; name: string; targetQuantity: number; unit: string; receivedQuantity: number; reservedQuantity: number; remainingQuantity: number; isComplete: boolean };
type Pledge = { id: string; budgetItemId: string; donorName: string; donorEmail: string; targetName: string; quantity: number; receivedQuantity: number; unit: string; note: string | null; status: string; createdAt: string; reviewedAt: string | null; completedAt: string | null };
type ManagerView = { summary: { targetAmount: number; donatedAmount: number; remainingAmount: number; confirmedDonationCount: number; targets: Target[]; inKindTargets: InKindTarget[]; isClosed: boolean }; pendingCount: number; donations: Donation[] };
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
  const [activeTab, setActiveTab] = useState<"money" | "in-kind">("money");
  const [donationPage, setDonationPage] = useState(1);
  const [inKindPage, setInKindPage] = useState(1);
  const load = useCallback(async (signal?: AbortSignal) => {
    const [moneyView, goodsView] = await Promise.all([
      api<ManagerView>(`/api/donations/manager/campaigns/${campaignId}`, { signal }),
      api<InKindView>(`/api/donations/manager/campaigns/${campaignId}/in-kind`, { signal }),
    ]);
    return { moneyView, goodsView };
  }, [campaignId]);
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
  const donationPages = Math.max(1, Math.ceil(view.donations.length / PAGE_SIZE));
  const pledgePages = Math.max(1, Math.ceil(pledges.length / PAGE_SIZE));
  const activeDonationPage = Math.min(donationPage, donationPages);
  const activeInKindPage = Math.min(inKindPage, pledgePages);
  const visibleDonations = view.donations.slice((activeDonationPage - 1) * PAGE_SIZE, activeDonationPage * PAGE_SIZE);
  const visiblePledges = pledges.slice((activeInKindPage - 1) * PAGE_SIZE, activeInKindPage * PAGE_SIZE);
  async function reviewPledge(id: string, decision: "APPROVE" | "REJECT") {
    await api(`/api/donations/in-kind/${id}/review`, { method: "POST", body: JSON.stringify({ decision }) });
    setRetry((n) => n + 1);
  }
  async function receivePledge(id: string) {
    await api(`/api/donations/in-kind/${id}/receive`, { method: "POST", body: JSON.stringify({ quantity: Number(receiveQuantities[id]) }) });
    setRetry((n) => n + 1);
  }
  return <section className={css.wrap} aria-labelledby="donations-manager-title">
    <header><h3 id="donations-manager-title">Quản lý ủng hộ chiến dịch</h3>
      <p>Theo dõi riêng tiền ủng hộ và hiện vật; danh sách chia thành từng trang, mỗi trang 5 bản ghi.</p></header>
    <div className={css.tabs} role="tablist" aria-label="Loại ủng hộ cần quản lý">
      <button id="donation-tab-money" type="button" role="tab" aria-selected={activeTab === "money"} aria-controls="donation-panel-money"
        className={activeTab === "money" ? css.activeTab : ""} onClick={() => setActiveTab("money")}>
        Tiền ủng hộ <span>{view.donations.length}</span>
      </button>
      <button id="donation-tab-in-kind" type="button" role="tab" aria-selected={activeTab === "in-kind"} aria-controls="donation-panel-in-kind"
        className={activeTab === "in-kind" ? css.activeTab : ""} onClick={() => setActiveTab("in-kind")}>
        Hiện vật <span>{pledges.length}</span>
      </button>
    </div>
    {activeTab === "money" && <div id="donation-panel-money" role="tabpanel" aria-labelledby="donation-tab-money" className={css.tabPanel}>
      <dl className={css.stats}>
        <div><dt>Mục tiêu gây quỹ</dt><dd>{money(summary.targetAmount)}</dd></div>
        <div><dt>Đã xác nhận</dt><dd>{money(summary.donatedAmount)}</dd></div>
        <div><dt>Còn thiếu</dt><dd>{money(summary.remainingAmount)}</dd></div>
        <div><dt>Lượt ủng hộ xác nhận</dt><dd>{summary.confirmedDonationCount}</dd></div>
        <div><dt>Giao dịch chờ xác nhận mô phỏng</dt><dd>{view.pendingCount}</dd></div>
      </dl>
      <section className={css.targets} aria-label="Tiến độ từng khoản dự toán">
        <h4>Tiến độ từng khoản</h4>
        {!summary.targets.length && <p className={css.empty}>Chưa có khoản chi được mở gây quỹ.</p>}
        {summary.targets.map((target) => <div className={css.target} key={target.budgetItemId}>
          <div className={css.targetHead}><strong>{target.name}</strong><span>{target.isComplete ? "Đã đủ mục tiêu" : `Còn thiếu ${money(target.remainingAmount)}`}</span></div>
          <progress max={Math.max(target.targetAmount, 1)} value={Math.min(target.donatedAmount, target.targetAmount)} />
          <small>{money(target.donatedAmount)} / {money(target.targetAmount)}</small>
        </div>)}
      </section>
      <section aria-labelledby="donor-list-title">
        <h4 id="donor-list-title">Danh sách người ủng hộ gần đây</h4>
        {!view.donations.length ? <p className={css.empty}>Chưa có giao dịch ủng hộ.</p> : <div className={css.tableWrap}>
          <table className={css.table}><thead><tr><th>Người ủng hộ</th><th>Ủng hộ cho</th><th>Số tiền</th><th>Tài khoản thử nghiệm</th><th>Trạng thái</th><th>Thời gian</th></tr></thead>
            <tbody>{visibleDonations.map((row) => <tr key={row.id}>
              <td>{row.donorName}<small>{row.donorEmail}</small><small>{row.reference}</small></td>
              <td>{row.targetName}</td><td>{money(row.amount)}</td><td>{row.payerAccountLast4 ? `•••• ${row.payerAccountLast4}` : "Chưa nhập"}</td>
              <td><span className={css.status} data-confirmed={row.status === "CONFIRMED"}>{row.status === "CONFIRMED" ? "Đã xác nhận OTP" : row.status === "OTP_PENDING" ? "Chờ OTP" : "Chờ thanh toán"}</span></td>
              <td>{time(row.confirmedAt ?? row.createdAt)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <Pagination page={activeDonationPage} pages={donationPages} total={view.donations.length} onChange={setDonationPage} />
      </section>
      <p className="muted">Đây là số liệu môi trường thử nghiệm; không đại diện cho tiền thật đã vào tài khoản.</p>
    </div>}
    {activeTab === "in-kind" && <div id="donation-panel-in-kind" role="tabpanel" aria-labelledby="donation-tab-in-kind" className={css.tabPanel}>
      {!!inKind?.targets.length && <section className={css.targets} aria-label="Tiến độ hiện vật">
        <h4>Tiến độ hiện vật</h4>
        {inKind.targets.map((target) => <div className={css.target} key={target.budgetItemId}>
          <div className={css.targetHead}><strong>{target.name}</strong><span>{target.isComplete ? "Đã đủ, đã đóng nhận" : `Còn thiếu ${target.remainingQuantity} ${target.unit}`}</span></div>
          <progress max={Math.max(target.targetQuantity, 1)} value={Math.min(target.receivedQuantity + target.reservedQuantity, target.targetQuantity)} />
          <small>Đã nhận {target.receivedQuantity} / {target.targetQuantity} {target.unit} · Đã duyệt chờ giao {target.reservedQuantity} {target.unit}</small>
        </div>)}
      </section>}
      <section aria-labelledby="in-kind-review-title">
        <h4 id="in-kind-review-title">Đề nghị tặng hiện vật</h4>
        {!pledges.length ? <p className={css.empty}>Chưa có đề nghị tặng hiện vật.</p> : <div className={css.tableWrap}>
          <table className={css.table}><thead><tr><th>Người tặng</th><th>Hiện vật</th><th>Ghi chú</th><th>Đã nhận</th><th>Trạng thái / thao tác</th></tr></thead>
            <tbody>{visiblePledges.map((row) => <tr key={row.id}>
              <td>{row.donorName}<small>{row.donorEmail}</small></td><td>{row.quantity} {row.unit} · {row.targetName}</td>
              <td>{row.note || "—"}</td><td>{row.receivedQuantity} / {row.quantity} {row.unit}</td>
              <td><span className={css.status} data-confirmed={row.status === "RECEIVED"}>{row.status === "PENDING" ? "Chờ duyệt" : row.status === "APPROVED" ? "Đã duyệt · chờ giao" : row.status === "RECEIVED" ? "Đã nhận đủ" : "Từ chối"}</span>
                {row.status === "PENDING" && <div className={css.rowActions}>
                  <button type="button" className={css.approveButton} onClick={() => void reviewPledge(row.id, "APPROVE")}><span aria-hidden="true">✓</span> Duyệt</button>
                  <button type="button" className={css.rejectButton} onClick={() => void reviewPledge(row.id, "REJECT")}><span aria-hidden="true">×</span> Từ chối</button>
                </div>}
                {row.status === "APPROVED" && <div className={css.rowActions}>
                  <input aria-label={`Số lượng nhận ${row.targetName}`} type="number" min="0.01" max={row.quantity - row.receivedQuantity} step="0.01" value={receiveQuantities[row.id] ?? String(row.quantity - row.receivedQuantity)} onChange={(event) => setReceiveQuantities((current) => ({ ...current, [row.id]: event.target.value }))} />
                  <button type="button" className={css.receiveButton} onClick={() => void receivePledge(row.id)}><span aria-hidden="true">↓</span> Ghi nhận nhận hàng</button>
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
