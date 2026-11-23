"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import css from "./CampaignDonationsTab.module.css";

type Target = { budgetItemId: string; name: string; targetAmount: number; donatedAmount: number; remainingAmount: number; isComplete: boolean };
type Donation = { id: string; donorName: string; donorEmail: string; targetName: string; payerAccountLast4: string | null; amount: number; status: string; reference: string; createdAt: string; confirmedAt: string | null };
type ManagerView = { summary: { targetAmount: number; donatedAmount: number; remainingAmount: number; confirmedDonationCount: number; targets: Target[] }; pendingCount: number; donations: Donation[] };
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const time = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function CampaignDonationsTab({ campaignId }: { campaignId: string }) {
  const [view, setView] = useState<ManagerView>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const load = useCallback((signal?: AbortSignal) => api<ManagerView>(
    `/api/donations/manager/campaigns/${campaignId}`, { signal }), [campaignId]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((result) => { if (!controller.signal.aborted) { setView(result); setError(""); } })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [load, retry]);

  if (error) return <p className={css.empty} role="alert">{error} <button type="button" className="quiet" onClick={() => setRetry((n) => n + 1)}>Tải lại</button></p>;
  if (!view) return <p role="status" className={css.empty}>Đang tải khoản ủng hộ…</p>;
  const { summary } = view;
  return <section className={css.wrap} aria-labelledby="donations-manager-title">
    <header><h3 id="donations-manager-title">Theo dõi tiền ủng hộ</h3>
      <p>Chỉ khoản đã xác nhận mới được tính vào tiến độ mục tiêu. Giao dịch ở đây là mô phỏng.</p></header>
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
          <tbody>{view.donations.map((row) => <tr key={row.id}>
            <td>{row.donorName}<small>{row.donorEmail}</small><small>{row.reference}</small></td>
            <td>{row.targetName}</td><td>{money(row.amount)}</td><td>{row.payerAccountLast4 ? `•••• ${row.payerAccountLast4}` : "Chưa nhập"}</td>
            <td><span className={css.status} data-confirmed={row.status === "CONFIRMED"}>{row.status === "CONFIRMED" ? "Đã xác nhận OTP" : row.status === "OTP_PENDING" ? "Chờ OTP" : "Chờ thanh toán"}</span></td>
            <td>{time(row.confirmedAt ?? row.createdAt)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    <p className="muted">Đây là số liệu môi trường thử nghiệm; không đại diện cho tiền thật đã vào tài khoản.</p>
  </section>;
}
