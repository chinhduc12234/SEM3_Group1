"use client";
import adminStyles from "@/features/admin/Admin.module.css";
import type { PageResult } from "@/shared/api/pagination";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/shared/api/api";
import Icon from "@/features/admin/components/AdminIcon";

type Owner = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  organizationCount: number;
  ownerSince: string;
  organizations: {
    id: string;
    legalName: string;
    status: string;
    province: string;
    ownerSince: string;
  }[];
};

export default function OwnerProfilesScreen() {
  const [result, setResult] = useState<PageResult<Owner> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api<PageResult<Owner>>(
      "/api/organizations/admin/owners?" +
        new URLSearchParams({ page: String(page), search: query }),
    )
      .then((data) => {
        if (live) setResult(data);
      })
      .catch((ex) => {
        if (live) setError((ex as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [page, query, refresh]);

  return (
    <LocalizedTree>
      <>
        <div className={`${adminStyles.pageHeading} ${adminStyles.ownerHeading}`}>
          <div>
            <p className={adminStyles.eyebrow}>TÀI KHOẢN & QUYỀN SỞ HỮU</p>
            <h1>Hồ sơ Owner</h1>
            <p>Tra cứu tài khoản Owner và các hồ sơ tổ chức được liên kết.</p>
          </div>
          <button className="secondary" disabled={loading} onClick={() => setRefresh((x) => x + 1)}>
            <Icon name="refresh" size={17} />
            Làm mới
          </button>
        </div>
        <section className={adminStyles.ownerIntro}>
          <div className={adminStyles.ownerIntroIcon}>
            <Icon name="shield" size={24} />
          </div>
          <div>
            <strong>Thông tin tài khoản được bảo vệ</strong>
            <p>
              Trang này hiển thị họ tên, email, trạng thái tài khoản và hồ sơ tổ chức Owner đã nộp.
              Mật khẩu không được hiển thị.
            </p>
          </div>
          <span>
            {result?.totalCount ?? "—"}
            <small>OWNER</small>
          </span>
        </section>
        <section className={`${adminStyles.directory} ${adminStyles.ownerDirectory}`}>
          <form
            className={adminStyles.searchForm}
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setPage(1);
              setQuery(search.trim());
            }}
          >
            <label className={adminStyles.searchField}>
              <Icon name="search" size={19} />
              <input
                aria-label="Tìm Owner"
                placeholder="Tìm theo họ tên, email hoặc tổ chức…"
                value={search}
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button type="submit">Tìm kiếm</button>
            {query && (
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setSearch("");
                  setQuery("");
                  setPage(1);
                }}
              >
                Xóa bộ lọc
              </button>
            )}
          </form>
          <div className={adminStyles.resultsCaption}>
            <h2>
              Danh sách Owner <span className={adminStyles.count}>{result?.totalCount ?? "—"}</span>
            </h2>
            <span>{loading ? "Đang tải hồ sơ…" : "Sắp xếp theo họ tên"}</span>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}{" "}
              <button className="quiet" onClick={() => setRefresh((x) => x + 1)}>
                Thử lại
              </button>
            </div>
          )}
          {loading ? (
            <div className={adminStyles.tableLoading}>
              <div className={adminStyles.skeleton} />
              <div className={adminStyles.skeleton} />
              <span>Đang tải danh sách Owner…</span>
            </div>
          ) : result && result.items.length ? (
            <div className={`table-wrap ${adminStyles.table}`}>
              <table>
                <thead>
                  <tr>
                    <th>TÀI KHOẢN OWNER</th>
                    <th>TỔ CHỨC LIÊN KẾT</th>
                    <th>TRẠNG THÁI</th>
                    <th>OWNER TỪ</th>
                    <th>
                      <span className={adminStyles.srOnly}>Hồ sơ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((owner) => (
                    <tr key={owner.id}>
                      <td>
                        <div className={adminStyles.ownerAccount}>
                          <span className={adminStyles.ownerAvatar}>
                            {owner.fullName.trim().charAt(0).toLocaleUpperCase("vi-VN")}
                          </span>
                          <span>
                            <strong>{owner.fullName}</strong>
                            <small>{owner.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={adminStyles.ownerOrgs}>
                          <strong>{owner.organizationCount} tổ chức</strong>
                          {owner.organizations.slice(0, 2).map((org) => (
                            <small key={org.id}>{org.legalName}</small>
                          ))}
                          {owner.organizationCount > 2 && (
                            <small>+{owner.organizationCount - 2} tổ chức khác</small>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${adminStyles.ownerState} ${owner.isActive ? "is-active" : adminStyles.isInactive}`}
                        >
                          {owner.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td>{new Date(owner.ownerSince).toLocaleDateString("vi-VN")}</td>
                      <td>
                        <Link
                          className={adminStyles.rowLink}
                          href={`/admin/owner-profiles/${owner.id}`}
                        >
                          Xem hồ sơ <Icon name="arrow" size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={adminStyles.pagination}>
                <span>
                  {result.totalCount
                    ? `${(page - 1) * result.pageSize + 1}–${Math.min(page * result.pageSize, result.totalCount)} / ${result.totalCount} Owner`
                    : "0 Owner"}
                </span>
                <div>
                  <button
                    className="secondary"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    ← Trước
                  </button>
                  <span>Trang {page}</span>
                  <button
                    className="secondary"
                    disabled={page * result.pageSize >= result.totalCount}
                    onClick={() => setPage(page + 1)}
                  >
                    Sau →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={adminStyles.ownerEmpty}>
              <span>
                <Icon name="user" size={24} />
              </span>
              <h3>{query ? "Không tìm thấy Owner phù hợp" : "Chưa có hồ sơ Owner"}</h3>
              <p>
                {query
                  ? "Thử tìm bằng họ tên, email hoặc tên tổ chức khác."
                  : "Owner sẽ xuất hiện sau khi hồ sơ tổ chức được phê duyệt."}
              </p>
            </div>
          )}
        </section>
      </>
    </LocalizedTree>
  );
}
