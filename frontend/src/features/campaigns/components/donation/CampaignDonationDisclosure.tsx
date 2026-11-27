"use client";

import { useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import styles from "./DonationPanel.module.css";

type Row = { donorName: string | null; targetName: string; amount: number; confirmedAt: string | null };
const vi = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function CampaignDonationDisclosure({ campaignId, revision }: { campaignId: string; revision: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const signal = controller.signal;
    setError("");
    setRows(undefined);
    api<Row[]>(`/api/donations/campaigns/${campaignId}/disclosure?page=${page}`, { signal })
      .then((result) => { if (!signal.aborted) setRows(result); })
      .catch((reason: Error) => { if (!signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [campaignId, open, page, revision, retry]);
  return <details className={styles.disclosure} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Kê khai ủng hộ mô phỏng</summary>
    {open && <div className={styles.disclosureBody}>
      {error && <div><p role="alert">{error}</p> <button type="button" className={styles.secondary} onClick={() => setRetry((value) => value + 1)}>Tải lại kê khai</button></div>}
      {!rows && !error && <p role="status">Đang tải kê khai…</p>}
      {rows?.length === 0 && <p>Chưa có khoản được xác nhận trên trang này.</p>}
      {!!rows?.length && <ul className={styles.targetList}>{rows.map((row, index) => <li key={index}>
        <strong>{vi.format(row.amount)}</strong><span>{row.targetName}</span>
        <small>{row.donorName || "Ẩn danh"}{row.confirmedAt && " · " + new Date(row.confirmedAt).toLocaleDateString("vi-VN")}</small>
      </li>)}</ul>}
      {(page > 1 || rows?.length === 20) && <nav className={styles.pagination} aria-label="Phân trang kê khai">
        <button type="button" className={styles.secondary} disabled={page === 1 || !rows} onClick={() => setPage(page - 1)}>Trang trước</button>
        <span> Trang {page} </span>
        <button type="button" className={styles.secondary} disabled={rows?.length !== 20} onClick={() => setPage(page + 1)}>Trang sau</button>
      </nav>}
    </div>}
  </details>;
}
