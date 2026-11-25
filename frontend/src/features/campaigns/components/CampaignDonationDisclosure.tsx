"use client";

import { useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import styles from "./DonationPanel.module.css";

type Row = { donorName: string | null; targetName: string; amount: number; confirmedAt: string | null };
const vi = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function CampaignDonationDisclosure({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
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
  }, [campaignId, open, page, revision]);
  return <details className={styles.goodsInfo} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Kê khai khoản ủng hộ sandbox</summary>
    {open && <>
      {error && <p role="alert">{error} <button type="button" onClick={() => setRevision((value) => value + 1)}>Tải lại</button></p>}
      {!rows && !error && <p role="status">Đang tải kê khai…</p>}
      {rows?.length === 0 && <p>Chưa có khoản được xác nhận trên trang này.</p>}
      {!!rows?.length && <ul>{rows.map((row, index) => <li key={index}>
        <strong>{row.donorName || "Ẩn danh"}</strong> · {vi.format(row.amount)} · {row.targetName}
        {row.confirmedAt && " · " + new Date(row.confirmedAt).toLocaleDateString("vi-VN")}
      </li>)}</ul>}
      {(page > 1 || rows?.length === 20) && <nav aria-label="Phân trang kê khai">
        <button type="button" disabled={page === 1 || !rows} onClick={() => setPage(page - 1)}>Trang trước</button>
        <span> Trang {page} </span>
        <button type="button" disabled={rows?.length !== 20} onClick={() => setPage(page + 1)}>Trang sau</button>
      </nav>}
    </>}
  </details>;
}
