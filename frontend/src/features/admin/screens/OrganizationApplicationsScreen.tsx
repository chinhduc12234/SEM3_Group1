"use client";
import adminStyles from "@/features/admin/Admin.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Protected from "@/features/auth/components/Protected";
import { api } from "@/shared/api/api";
import { statuses } from "@/features/organizations/types/organizations";
import Icon from "@/features/admin/components/AdminIcon";
type Result = {
  items: {
    id: string;
    legalName: string;
    registrationNumber: string;
    status: string;
    submittedAt: string | null;
  }[];
  totalCount: number;
  page: number;
};
function Administration() {
  const params = useSearchParams();
  const initial = params.get("status");
  const [status, setStatus] = useState(
    initial !== null && (initial === "" || initial in statuses) ? initial : "PENDING_REVIEW",
  );
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const value = params.get("status");
    if (value !== null && (value === "" || value in statuses)) {
      setStatus(value);
      setPage(1);
    }
  }, [params]);
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    setLoading(true);
    api<Result>(
      "/api/organizations?" + new URLSearchParams({ page: String(page), status, search: query }),
    )
      .then((r) => {
        if (live) setData(r);
      })
      .catch((ex) => {
        if (live) setError(ex.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [status, query, page, refresh]);
  function reset() {
    setSearch("");
    setQuery("");
    setStatus("");
    setPage(1);
  }
  return (
    <LocalizedTree>
      <>
        <div className={adminStyles.pageHeading}>
          <div>
            <p className={adminStyles.eyebrow}>KẾT NỐI & ĐỒNG HÀNH</p>
            <h1>Quản trị tổ chức</h1>
            <p>Xem hồ sơ, đối chiếu giấy tờ và gửi phản hồi đến tổ chức.</p>
          </div>
          <button className="secondary" disabled={loading} onClick={() => setRefresh((x) => x + 1)}>
            <Icon name="refresh" size={17} />
            Làm mới
          </button>
        </div>
        <section className={adminStyles.directory}>
          <div className={adminStyles.statusTabs} role="group" aria-label="Lọc theo trạng thái">
            {[["", "Tất cả"], ...Object.entries(statuses)].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={status === key}
                onClick={() => {
                  setStatus(key);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className={adminStyles.searchForm}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setPage(1);
              setQuery(search.trim());
            }}
          >
            <label className={adminStyles.searchField}>
              <Icon name="search" size={19} />
              <input
                aria-label="Tìm tổ chức"
                placeholder="Tìm theo tên tổ chức hoặc số đăng ký…"
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button type="submit">Tìm kiếm</button>
            {(query || status) && (
              <button className="secondary" type="button" onClick={reset}>
                Xóa bộ lọc
              </button>
            )}
          </form>
          <div className={adminStyles.resultsCaption}>
            <h2>
              Danh sách hồ sơ <span className={adminStyles.count}>{data?.totalCount ?? "—"}</span>
            </h2>
            <span>
              {status ? statuses[status] : "Tất cả trạng thái"}
              {query ? " · Kết quả cho “" + query + "”" : ""}
            </span>
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
            <div className={adminStyles.tableLoading} role="status">
              <div className={adminStyles.skeleton} />
              <div className={adminStyles.skeleton} />
              <div className={adminStyles.skeleton} />
              <span>Đang tải danh sách hồ sơ…</span>
            </div>
          ) : (
            data && (
              <>
                <div className={`table-wrap ${adminStyles.table}`}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Tổ chức</th>
                        <th scope="col">Ngày gửi hồ sơ</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">
                          <span className={adminStyles.srOnly}>Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className={adminStyles.orgCell}>
                              <span className={adminStyles.orgAvatar}>
                                {item.legalName.charAt(0)}
                              </span>
                              <div>
                                <strong>{item.legalName}</strong>
                                <small>{item.registrationNumber}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {item.submittedAt
                              ? new Date(item.submittedAt).toLocaleDateString("vi-VN")
                              : "Chưa gửi"}
                          </td>
                          <td>
                            <span className={"badge " + item.status}>{statuses[item.status]}</span>
                          </td>
                          <td>
                            <Link
                              className={adminStyles.rowLink}
                              href={"/admin/organizations/" + item.id}
                            >
                              Xem hồ sơ <Icon name="arrow" size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.items.length && (
                    <div className={adminStyles.empty}>
                      <span className={adminStyles.emptyIllustration}>
                        <Icon name="search" size={32} />
                      </span>
                      <h3>Chưa tìm thấy hồ sơ phù hợp</h3>
                      <p>
                        Thử một từ khóa khác hoặc chuyển trạng thái để xem thêm hồ sơ trên hệ thống.
                      </p>
                      <button className="secondary" onClick={reset}>
                        Xem tất cả hồ sơ
                      </button>
                    </div>
                  )}
                </div>
                <div className={adminStyles.pagination}>
                  <span>
                    {data.totalCount
                      ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, data.totalCount)} / ${data.totalCount} hồ sơ`
                      : "0 hồ sơ"}
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
                      disabled={page * 20 >= data.totalCount}
                      onClick={() => setPage(page + 1)}
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              </>
            )
          )}
        </section>
        <div className={adminStyles.directoryNote}>
          <Icon name="shield" size={18} />
          <p>
            Kiểm tra đầy đủ giấy tờ trước khi xét duyệt. Các quyết định và phản hồi được lưu trong
            lịch sử hồ sơ.
          </p>
        </div>
      </>
    </LocalizedTree>
  );
}
export default function OrganizationApplicationsScreen() {
  return (
    <LocalizedTree>
      <Protected admin>
        <Suspense fallback={<p className="notice">Đang mở quản trị tổ chức…</p>}>
          <Administration />
        </Suspense>
      </Protected>
    </LocalizedTree>
  );
}
