"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/shared/api/api";
import Icon from "@/features/dashboard/components/AdminIcon";

type Owner = { id: string; fullName: string; email: string; isActive: boolean; organizationCount: number; ownerSince: string; organizations: { id: string; legalName: string; status: string; province: string; ownerSince: string }[] };
type PageResult = { items: Owner[]; totalCount: number; page: number; pageSize: number };

export default function OwnerProfilesPage() {
  const [result, setResult] = useState<PageResult | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    api<PageResult>("/api/organizations/admin/owners?" + new URLSearchParams({ page: String(page), search: query }))
      .then(data => { if (live) setResult(data); })
      .catch(ex => { if (live) setError((ex as Error).message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [page, query, refresh]);

  return <>
    <div className="ad-page-heading ad-owner-heading"><div><p className="ad-eyebrow">TÀI KHOẢN & QUYỀN SỞ HỮU</p><h1>Hồ sơ Owner</h1><p>Tra cứu tài khoản Owner và các hồ sơ tổ chức được liên kết.</p></div><button className="secondary ad-refresh" disabled={loading} onClick={() => setRefresh(x => x + 1)}><Icon name="refresh" size={17}/>Làm mới</button></div>
    <section className="ad-owner-intro"><div className="ad-owner-intro-icon"><Icon name="shield" size={24}/></div><div><strong>Thông tin tài khoản được bảo vệ</strong><p>Trang này hiển thị họ tên, email, trạng thái tài khoản và hồ sơ tổ chức Owner đã nộp. Mật khẩu không được hiển thị.</p></div><span>{result?.totalCount ?? "—"}<small>OWNER</small></span></section>
    <section className="ad-directory ad-owner-directory">
      <form className="ad-search-form" onSubmit={(event: FormEvent) => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}><label className="ad-search-field"><Icon name="search" size={19}/><input aria-label="Tìm Owner" placeholder="Tìm theo họ tên, email hoặc tổ chức…" value={search} maxLength={100} onChange={event => setSearch(event.target.value)}/></label><button type="submit">Tìm kiếm</button>{query && <button className="secondary" type="button" onClick={() => { setSearch(""); setQuery(""); setPage(1); }}>Xóa bộ lọc</button>}</form>
      <div className="ad-results-caption"><h2>Danh sách Owner <span className="ad-count">{result?.totalCount ?? "—"}</span></h2><span>{loading ? "Đang tải hồ sơ…" : "Sắp xếp theo họ tên"}</span></div>
      {error && <div className="notice error" role="alert">{error} <button className="quiet" onClick={() => setRefresh(x => x + 1)}>Thử lại</button></div>}
      {loading ? <div className="ad-table-loading"><div className="ad-skeleton"/><div className="ad-skeleton"/><span>Đang tải danh sách Owner…</span></div> : result && result.items.length ? <div className="table-wrap ad-table"><table><thead><tr><th>TÀI KHOẢN OWNER</th><th>TỔ CHỨC LIÊN KẾT</th><th>TRẠNG THÁI</th><th>OWNER TỪ</th><th><span className="ad-sr-only">Hồ sơ</span></th></tr></thead><tbody>{result.items.map(owner => <tr key={owner.id}>
        <td><div className="ad-owner-account"><span className="ad-owner-avatar">{owner.fullName.trim().charAt(0).toLocaleUpperCase("vi-VN")}</span><span><strong>{owner.fullName}</strong><small>{owner.email}</small></span></div></td>
        <td><div className="ad-owner-orgs"><strong>{owner.organizationCount} tổ chức</strong>{owner.organizations.slice(0, 2).map(org => <small key={org.id}>{org.legalName}</small>)}{owner.organizationCount > 2 && <small>+{owner.organizationCount - 2} tổ chức khác</small>}</div></td>
        <td><span className={`ad-owner-state ${owner.isActive ? "is-active" : "is-inactive"}`}>{owner.isActive ? "Đang hoạt động" : "Đã khóa"}</span></td>
        <td>{new Date(owner.ownerSince).toLocaleDateString("vi-VN")}</td>
        <td><Link className="ad-row-link" href={`/admin/owner-profiles/${owner.id}`}>Xem hồ sơ <Icon name="arrow" size={16}/></Link></td>
      </tr>)}</tbody></table><div className="ad-pagination"><span>{result.totalCount ? `${(page - 1) * result.pageSize + 1}–${Math.min(page * result.pageSize, result.totalCount)} / ${result.totalCount} Owner` : "0 Owner"}</span><div><button className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>← Trước</button><span>Trang {page}</span><button className="secondary" disabled={page * result.pageSize >= result.totalCount} onClick={() => setPage(page + 1)}>Sau →</button></div></div></div> : <div className="ad-owner-empty"><span><Icon name="user" size={24}/></span><h3>{query ? "Không tìm thấy Owner phù hợp" : "Chưa có hồ sơ Owner"}</h3><p>{query ? "Thử tìm bằng họ tên, email hoặc tên tổ chức khác." : "Owner sẽ xuất hiện sau khi hồ sơ tổ chức được phê duyệt."}</p></div>}
    </section>
  </>;
}
