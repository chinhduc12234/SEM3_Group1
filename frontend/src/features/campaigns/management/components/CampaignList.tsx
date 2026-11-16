import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";
import { campaignStatuses } from "@/features/campaigns/types/campaigns";

type Props = Pick<
  CampaignManagementModel,
  | "deleteCampaign"
  | "busy"
  | "manager"
  | "viewCampaign"
  | "editCampaign"
  | "owner"
  | "page"
  | "pageSize"
  | "rows"
  | "search"
  | "setPage"
  | "setSearch"
  | "setStatusFilter"
  | "statusFilter"
>;

export default function CampaignList({
  busy,
  deleteCampaign,
  manager,
  viewCampaign,
  editCampaign,
  owner,
  page,
  pageSize,
  rows,
  search,
  setPage,
  setSearch,
  setStatusFilter,
  statusFilter,
}: Props) {
  return (
    <LocalizedTree>
      <section className={`panel ${managementStyles.campaignList}`}>
        <div className={managementStyles.campaignListHead}>
          <div>
            <h2>Danh sách chiến dịch</h2>
            <p>Tất cả chiến dịch của tổ chức bạn quản lý</p>
          </div>
          <div className={managementStyles.campaignFilters}>
            <input
              aria-label="Tìm kiếm chiến dịch"
              placeholder="Tìm kiếm chiến dịch..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Lọc trạng thái chiến dịch"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(campaignStatuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {rows?.items
          .filter(
            (c) =>
              (statusFilter === "ALL" || c.status === statusFilter) &&
              `${c.title} ${c.description} ${c.location}`
                .toLowerCase()
                .includes(search.trim().toLowerCase()),
          )
          .map((c) => (
            <article className={managementStyles.campaignRow} key={c.id}>
              <div className={managementStyles.campaignCover}>
                {c.coverMediaId ? (
                  <img
                    src={`/api/campaigns/${c.id}/media/${c.coverMediaId}`}
                    alt={`Ảnh thumbnail: ${c.title}`}
                  />
                ) : (
                  <span>Chưa có ảnh bìa</span>
                )}
                <small>{campaignStatuses[c.status]}</small>
              </div>
              <div className={managementStyles.campaignSummary}>
                <strong>{c.title}</strong>
                <p>{c.description}</p>
                <small>
                  ⌖ {c.location}　·　{c.startDate} – {c.endDate}
                </small>
              </div>
              <div className={managementStyles.campaignGoal}>
                <strong>{c.goalAmount.toLocaleString("vi-VN")} đ</strong>
                <small>Cần quyên góp</small>
              </div>
              <div className={managementStyles.campaignActions}>
                {manager && c.status === "PENDING_REVIEW" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void editCampaign(c.id)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none">
                      <path
                        d="m11.3 2.7 2 2M3 13l2.8-.6 7.5-7.5a1.4 1.4 0 0 0-2-2l-7.5 7.5L3 13Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Chỉnh sửa</span>
                  </button>
                )}
                {owner && c.status === "PENDING_REVIEW" && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void viewCampaign(c.id)}
                  >
                    Xét duyệt
                  </button>
                )}
                <button disabled={busy} onClick={() => void viewCampaign(c.id)}>
                  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none">
                    <path
                      d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4S1.5 8 1.5 8Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <circle cx="8" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span>Xem chi tiết</span>
                </button>
                {manager && ["DRAFT", "NEEDS_REVISION", "REJECTED"].includes(c.status) && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Xóa chiến dịch “${c.title}”?`)) return;
                      void deleteCampaign(c.id);
                    }}
                  >
                    Xóa chiến dịch
                  </button>
                )}
              </div>
            </article>
          ))}
        {rows?.items.length === 0 && <p>Chưa có chiến dịch.</p>}
        <div className="actions">
          <button disabled={busy || page === 1} onClick={() => setPage((p) => p - 1)}>
            Trước
          </button>
          <span>Trang {page}</span>
          <button
            disabled={busy || !rows || page * pageSize >= rows.totalCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </button>
        </div>
      </section>
    </LocalizedTree>
  );
}
