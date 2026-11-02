"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { statuses } from "@/lib/organizations";
type Result = { items: { id: string; legalName: string; registrationNumber: string; status: string; submittedAt: string | null }[]; totalCount: number; page: number };
function Administration() {
  const [status, setStatus] = useState("PENDING_REVIEW"); const [search, setSearch] = useState(""); const [query, setQuery] = useState(""); const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true; setError(""); setLoading(true);
    api<Result>("/api/organizations?" + new URLSearchParams({ page: String(page), status, search: query })).then(result => { if (live) setData(result); }).catch(ex => { if (live) setError(ex.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [status, query, page]);
  return <><p className="eyebrow">Không gian quản trị</p><h1>Hồ sơ tổ chức đăng ký</h1><p className="muted">Xem giấy tờ và thông tin đại diện để đưa ra quyết định có lưu vết.</p>
    <form className="filters" onSubmit={(e: FormEvent) => { e.preventDefault(); setPage(1); setQuery(search); }}><input aria-label="Tìm tổ chức" placeholder="Tên tổ chức hoặc số đăng ký…" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} /><select aria-label="Trạng thái" value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><button>Tìm kiếm</button></form>
    {error && <p className="notice error" role="alert">{error}</p>}{loading ? <p>Đang tải hồ sơ…</p> : data && <><p className="muted">{data.totalCount} hồ sơ</p><div className="table-wrap"><table><thead><tr><th>Tổ chức / Số đăng ký</th><th>Ngày gửi</th><th>Trạng thái</th><th></th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td><strong>{item.legalName}</strong><small>{item.registrationNumber}</small></td><td>{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("vi-VN") : "Chưa gửi"}</td><td><span className={"badge " + item.status}>{statuses[item.status]}</span></td><td><Link href={"/organizations/" + item.id}>Xem chi tiết →</Link></td></tr>)}</tbody></table>{!data.items.length && <p className="empty">Chưa có hồ sơ phù hợp với bộ lọc.</p>}</div><div className="actions pagination"><button className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="secondary" disabled={page * 20 >= data.totalCount} onClick={() => setPage(page + 1)}>Trang sau</button></div></>}
  </>;
}
export default function Page() { return <Protected admin><Administration /></Protected>; }
