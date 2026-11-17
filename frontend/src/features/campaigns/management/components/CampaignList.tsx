import { useEffect, useState } from "react";
import Link from "next/link";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { apiBlob } from "@/shared/api/api";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";
import { campaignStatuses, campaignTypes } from "@/features/campaigns/types/campaigns";
import { formatCampaignDate } from "../../formatCampaignDate";
import type { CampaignRow } from "../campaignManagement";
import OperationsStatusBadge from "./OperationsStatusBadge";
import PlanReadiness from "./PlanReadiness";

function CampaignCover({ campaign }: { campaign: CampaignRow }) {
  const [preview, setPreview] = useState("");
  const mediaPath = campaign.coverMediaId ? `/api/campaigns/${campaign.id}/media/${campaign.coverMediaId}` : "";
  const isPublic = campaign.status === "PUBLISHED";

  useEffect(() => {
    setPreview("");
    if (!mediaPath || isPublic) return;
    const controller = new AbortController();
    let url = "";
    apiBlob(mediaPath).then((blob) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setPreview(url);
    }).catch(() => {});
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [isPublic, mediaPath]);

  const src = isPublic ? mediaPath : preview;
  return (
    <div className={managementStyles.campaignCover}>
      {src ? <img src={src} alt={`Ảnh đại diện của ${campaign.title}`} /> : <span>Ảnh đại diện</span>}
      <small>{campaignStatuses[campaign.status]}</small>
    </div>
  );
}

type Props = Pick<
  CampaignManagementModel,
  | "actorId"
  | "assignedOnly"
  | "setAssignedOnly"
  | "deleteCampaign"
  | "busy"
  | "manager"
  | "campaignsPath"
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
  | "setTypeFilter"
  | "typeFilter"
>;

export default function CampaignList({
  actorId,
  assignedOnly,
  setAssignedOnly,
  busy,
  deleteCampaign,
  manager,
  campaignsPath,
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
  setTypeFilter,
  typeFilter,
}: Props) {
  return (
    <LocalizedTree>
      <section className={`panel ${managementStyles.campaignList}`}>
        <div className={managementStyles.campaignListHead}>
          <div>
            <h2>{assignedOnly ? "Chiến dịch và sự kiện được phân công" : "Danh sách chiến dịch và sự kiện"}</h2>
          </div>
          <div className={managementStyles.campaignFilters}>
            {(owner || manager) && <select aria-label="Phạm vi hồ sơ" value={assignedOnly ? "assigned" : "all"}
              onChange={(e) => { setAssignedOnly(e.target.value === "assigned"); setPage(1); }}>
              <option value="all">Hồ sơ có quyền xem</option>
              <option value="assigned">Được phân công</option>
            </select>}
            <select aria-label="Lọc theo loại hồ sơ" value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="ALL">Tất cả loại hồ sơ</option>
              <option value="CAMPAIGN">{campaignTypes.CAMPAIGN}</option>
              <option value="EVENT">{campaignTypes.EVENT}</option>
            </select>
            <input
              aria-label="Tìm kiếm chiến dịch"
              placeholder="Tìm kiếm chiến dịch..."
              maxLength={200}
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
        {rows?.items.map((c) => (
            <article className={managementStyles.campaignRow} key={c.id}>
              <CampaignCover campaign={c} />
              <div className={managementStyles.campaignSummary}>
                <strong>{c.title || "Đề xuất chưa có tên"}</strong>
                {c.isAssigned && <p>Được phân công</p>}
                {c.description && <p>{c.description}</p>}
                <small>
                  {[campaignTypes[c.campaignType], c.location, (c.startDate || c.endDate)
                    ? `${formatCampaignDate(c.startDate)} – ${formatCampaignDate(c.endDate)}`
                    : ""].filter(Boolean).join(" · ")}
                </small>
                {owner && c.status === "PLANNING" ? <PlanReadiness {...c} /> : (c.status === "PLANNING" || c.operationsConfirmedAt) && (
                  <div className={managementStyles.operationsRowStatus}>
                    <OperationsStatusBadge confirmedAt={c.operationsConfirmedAt} />
                  </div>
                )}
              </div>
              {c.status === "PUBLISHED" && c.goalAmount > 0 ? <div className={managementStyles.campaignGoal}>
                <strong>{c.goalAmount.toLocaleString("vi-VN")} đ</strong>
                <small>Cần quyên góp</small>
              </div> : <div className={managementStyles.campaignGoalSpacer} aria-hidden="true" />}
              <div className={managementStyles.campaignActions}>
                {owner && ["CONCEPT_APPROVED", "PLANNING"].includes(c.status) &&
                  <Link className="button" href={`${campaignsPath}/${c.id}/workflow`}>
                    {c.status === "CONCEPT_APPROVED" ? "Phân công" : "Phân công và duyệt ngày bổ sung"}
                  </Link>}
                {owner && ["PENDING_FINAL_REVIEW", "FINAL_APPROVED"].includes(c.status) &&
                  <Link className="button" href={`${campaignsPath}/${c.id}/workflow`}>
                    {c.status === "FINAL_APPROVED" ? "Công bố" : "Duyệt kế hoạch cuối"}
                  </Link>}
                {manager && c.isAssigned && c.status === "PLANNING" &&
                  <Link className="button secondary" href={`${campaignsPath}/${c.id}/workflow`}>Gửi duyệt cuối</Link>}
                {(owner || (manager && c.isAssigned)) && c.status === "FINAL_REJECTED" &&
                  <Link className="button secondary" href={`${campaignsPath}/${c.id}/workflow`}>Xem lý do từ chối</Link>}
                {c.status === "PUBLISHED" && !c.legacyPublished &&
                  <Link className="button secondary" href={`/chien-dich/${c.id}`}>Xem trang công khai</Link>}
                {manager && (c.legacyPublished || (c.createdBy === actorId && ["DRAFT", "NEEDS_REVISION"].includes(c.status))) && (
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
                {owner && c.createdBy !== actorId && ["PENDING_REVIEW", "PENDING_CONCEPT_APPROVAL"].includes(c.status) && (
                  <Link className="button" href={`${campaignsPath}/${c.id}/workflow`}>Duyệt ý tưởng</Link>
                )}
                <Link className="button" href={`${campaignsPath}/${c.id}`}>
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
                </Link>
                {manager && c.createdBy === actorId && c.status === "DRAFT" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm("Xóa bản nháp này?")) return;
                      void deleteCampaign(c.id);
                    }}
                  >
                    Xóa bản nháp
                  </button>
                )}
              </div>
            </article>
          ))}
        {rows?.items.length === 0 && <p>Không tìm thấy hồ sơ phù hợp.</p>}
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
