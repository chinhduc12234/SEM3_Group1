"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/shared/api/api";
import styles from "../Account.module.css";

export const historyTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function useActivityList<T>(url: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<T[]>(url + (url.includes("?") ? "&" : "?") + "page=" + page, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setRows(data);
    }).catch((reason: Error) => {
      if (!controller.signal.aborted) setError(reason.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [url, page, revision]);
  return { rows, setRows, page, setPage, error, loading, reload: () => setRevision((value) => value + 1) };
}

export function ActivityList({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return <section id={id} tabIndex={id ? -1 : undefined} className={styles.accountActivityList}><h2>{title}</h2>{children}</section>;
}

export function ActivityPager({ page, next, disabled, onChange }: {
  page: number; next: boolean; disabled: boolean; onChange: (page: number) => void;
}) {
  if (page === 1 && !next) return null;
  return <nav aria-label="Phân trang lịch sử">
    <button disabled={disabled || page === 1} onClick={() => onChange(page - 1)}>Trang trước</button>
    <span>Trang {page}</span>
    <button disabled={disabled || !next} onClick={() => onChange(page + 1)}>Trang sau</button>
  </nav>;
}
