"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useCampaignManagement } from "./hooks/useCampaignManagement";
import CampaignList from "./components/CampaignList";
import OwnerReviewPanel from "./components/OwnerReviewPanel";
import CampaignEditFields from "./components/CampaignEditFields";
import SubmittedCampaignDetails, { SubmittedCampaignBudget, SubmittedCampaignSchedule } from "./components/SubmittedCampaignDetails";
import CampaignAttachments from "./components/CampaignAttachments";
import CampaignWizard from "./CampaignWizard";
import wizardStyles from "./CampaignWizard.module.css";
import CampaignConceptDetails from "./components/CampaignConceptDetails";
import CampaignFinalReview from "./components/CampaignFinalReview";
import CampaignAssignmentPanel from "./components/CampaignAssignmentPanel";
import CampaignOperationsOverview from "./components/CampaignOperationsOverview";
import CampaignExtraDayApprovals from "./components/CampaignExtraDayApprovals";
import CampaignBudgetOverview from "./budget/CampaignBudgetOverview";
import { assignmentRoles, campaignStatuses, campaignTypes, type AssignmentRole } from "../types/campaigns";

const detailTabs = [
  ["assignments", "Phân công"],
  ["information", "Thông tin chiến dịch"],
  ["operations", "Vận hành"],
  ["budget", "Ngân sách"],
] as const;

export default function CampaignManagementScreen({ createPage = false, campaignId, workflowPage = false }: {
  createPage?: boolean; campaignId?: string; workflowPage?: boolean;
}) {
  const model = useCampaignManagement(createPage, campaignId);
  const requestedTab = useSearchParams().get("tab");
  const activeTab = detailTabs.find(([tab]) => tab === requestedTab)?.[0] ?? "information";
  const {
    action,
    actorId,
    assignedOnly,
    setAssignedOnly,
    assignCampaign,
    canList,
    canViewDetails,
    busy,
    canReviewSelected,
    creating,
    editingSelected,
    error,
    id,
    manager,
    mediaPreviews,
    message,
    note,
    campaignsPath,
    linkedCampaign,
    editCampaign,
    deleteCampaign,
    reviewCampaign,
    finishDraft,
    owner,
    operations,
    finance,
    page,
    pageSize,
    publishedEditable,
    router,
    rows,
    save,
    search,
    selected,
    setCreating,
    setBusy,
    setEditingSelected,
    setMessage,
    setNote,
    setPage,
    setSearch,
    setSelected,
    setStatusFilter,
    statusFilter,
    setTypeFilter,
    typeFilter,
    submittedDetails,
    submittedSchedules,
    submittedStops,
  } = model;
  const detailPage = !!campaignId && !workflowPage;
  const showInformation = !detailPage || activeTab === "information";
  const canOpenPage = createPage ? manager : workflowPage ? owner || manager : campaignId || linkedCampaign ? canViewDetails : canList;
  const canSubmitFinal = manager && !!actorId && !!selected?.assignments.some((assignment) =>
    assignment.role === "CAMPAIGN_MANAGER" && assignment.userId === actorId);
  const backHref = canList ? campaignsPath : `/organizations/${id}/manage${operations ? "/operations" : finance ? "/budget" : ""}`;
  const backLabel = manager ? "Chiến dịch và sự kiện" : owner ? "Duyệt và phân công" : operations ? "Vận hành" : finance ? "Ngân sách" : "Không gian tổ chức";
  if (!canOpenPage)
    return (
      <LocalizedTree>
        <p className="notice">
          {createPage ? "Bạn cần quyền Quản lý chiến dịch để tạo bản nháp." : "Bạn không có quyền xem danh sách chiến dịch."}
        </p>
      </LocalizedTree>
    );
  return (
    <LocalizedTree>
      <>
        {(createPage || campaignId) && message && (
          <p className="notice success" role="status">
            {message}
          </p>
        )}
        {campaignId && <>
          <Link href={backHref} className={managementStyles.detailBack}>← {backLabel}</Link>
          {error && <p className="notice error" role="alert">{error}</p>}
          {!selected && !error && <p role="status">Đang tải hồ sơ…</p>}
          {selected && <header className={managementStyles.detailHeader}>
            <div className={managementStyles.detailMeta}>
              <span>{campaignTypes[selected.campaignType]}</span>
              <span className={`badge ${selected.status}`}>{campaignStatuses[selected.status]}</span>
            </div>
            <h1>{selected.title || "Đề xuất chưa có tên"}</h1>
          </header>}
        </>}
        {!createPage && !campaignId && (
          <>
            {(canList || !linkedCampaign) && <header className={managementStyles.campaignOverviewHeader}>
              <div>
                <p className={managementStyles.campaignEyebrow}>KHÔNG GIAN TỔ CHỨC · CHIẾN DỊCH</p>
                <h1>{manager ? "Chiến dịch và sự kiện" : "Duyệt và phân công"}</h1>
                <p>{manager
                  ? "Tạo đề xuất, theo dõi tiến độ và phối hợp cùng đội ngũ trong một nơi."
                  : "Xem các đề xuất đang chờ và điều phối người phụ trách theo từng chiến dịch."}</p>
              </div>
              {manager && <button
                className={managementStyles.campaignCreateAction}
                disabled={busy}
                onClick={() => router.push(`/organizations/${id}/manage/campaigns/create`)}
              >
                <span aria-hidden="true">＋</span> Tạo chiến dịch
              </button>}
            </header>}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice success" role="status">
                {message}
              </p>
            )}
            {linkedCampaign && !error && <p role="status">Đang mở hồ sơ…</p>}
            {canList && !linkedCampaign && <CampaignList
              actorId={actorId}
              assignedOnly={assignedOnly}
              setAssignedOnly={setAssignedOnly}
              deleteCampaign={deleteCampaign}
              busy={busy}
              manager={manager}
              campaignsPath={campaignsPath}
              editCampaign={editCampaign}
              owner={owner}
              page={page}
              pageSize={pageSize}
              rows={rows}
              search={search}
              setPage={setPage}
              setSearch={setSearch}
              setStatusFilter={setStatusFilter}
              statusFilter={statusFilter}
              setTypeFilter={setTypeFilter}
              typeFilter={typeFilter}
            />}
          </>
        )}
        {(creating || editingSelected || ((campaignId || createPage) && selected)) && (
          <div
            className={creating && !createPage ? managementStyles.campaignOverlay : undefined}
            onKeyDown={(e) => {
              if (creating && !createPage && !busy && e.key === "Escape") {
                setCreating(false);
                setSelected(null);
                setEditingSelected(false);
              }
            }}
          >
            <section
              className={
                creating
                  ? `panel ${createPage ? managementStyles.campaignPage : managementStyles.campaignDialog}`
                  : campaignId ? `panel ${managementStyles.detailPanel}` : "panel"
              }
              role={creating && !createPage ? "dialog" : undefined}
              aria-modal={creating && !createPage ? true : undefined}
              aria-labelledby={creating ? "campaign-create-title" : undefined}
              key={selected?.id || "new"}
            >
              {creating && !createPage && (
                <button
                  type="button"
                  disabled={busy}
                  className={`secondary ${managementStyles.campaignClose}`}
                  aria-label="Đóng biểu mẫu chiến dịch"
                  onClick={() => {
                    setCreating(false);
                    setSelected(null);
                    setEditingSelected(false);
                  }}
                >
                  ✕
                </button>
              )}
              {creating && createPage ? (
                <header className={wizardStyles.pageHeader}>
                  <button type="button" className={`quiet ${wizardStyles.back}`} disabled={busy} onClick={() => router.push(`/organizations/${id}/manage/campaigns`)}>
                    <span aria-hidden="true">← </span>Chiến dịch và sự kiện
                  </button>
                  <div className={wizardStyles.titleGroup}>
                    <p className={wizardStyles.eyebrow}>ĐỀ XUẤT MỚI <span aria-hidden="true">·</span> 5 BƯỚC</p>
                    <h2 id="campaign-create-title">Tạo chiến dịch hoặc sự kiện</h2>
                    <p className={wizardStyles.intro}>Chia sẻ ý tưởng của bạn. Hoàn thiện từng bước để gửi đề xuất đến Owner xét duyệt.</p>
                  </div>
                </header>
              ) : (!campaignId || creating) && (
              <h2 id={creating ? "campaign-create-title" : undefined}>
                {creating
                  ? selected ? "Chỉnh sửa đề xuất" : "Tạo chiến dịch / sự kiện"
                  : selected?.title || "Đề xuất chưa có tên"}
              </h2>
              )}
              {detailPage && selected && <nav aria-label="Nội dung hồ sơ" className={managementStyles.detailTabs}>
                {detailTabs.map(([tab, label]) => <Link key={tab}
                  href={`${campaignsPath}/${selected.id}?tab=${tab}`}
                  scroll={false} aria-current={tab === activeTab ? "page" : undefined}>{label}</Link>)}
              </nav>}
              {workflowPage && selected && (owner || canSubmitFinal) &&
                ["PLANNING", "PENDING_FINAL_REVIEW", "FINAL_APPROVED", "FINAL_REJECTED", "PUBLISHED"].includes(selected.status) &&
                <CampaignFinalReview key={selected.id} campaign={selected} owner={owner} canSubmit={canSubmitFinal}
                  busy={busy} action={action} onUpdate={(campaign, message) => { setSelected(campaign); setMessage(message); }} />}
              {workflowPage && selected?.status === "PUBLISHED" &&
                <p><Link href={`/chien-dich/${selected.id}`}>Xem trang công khai</Link></p>}
              {workflowPage && owner && selected && ["CONCEPT_APPROVED", "PLANNING"].includes(selected.status) && (
                <CampaignAssignmentPanel key={selected.version} campaign={selected} busy={busy} onSave={assignCampaign} />
              )}
              {workflowPage && owner && selected?.status === "PLANNING" && <CampaignExtraDayApprovals
                campaignId={selected.id} version={selected.version} busy={busy} action={action}
                onApproved={(version) => {
                  setSelected({ ...selected, version });
                  setMessage("Đã duyệt ngày bổ sung.");
                }}
              />}
              {detailPage && selected && activeTab === "assignments" && (
                <section aria-label="Phân công">
                  <div className={managementStyles.detailAssignments}>
                      {(Object.keys(assignmentRoles) as AssignmentRole[]).map((role) => {
                        const people = selected.assignments.filter((item) => item.role === role);
                        return <section className={managementStyles.reviewBlock} key={role}>
                          <h3>{assignmentRoles[role]}</h3>
                          {people.length ? <ul>{people.map((item) => <li key={item.userId}>
                            {item.fullName} · {item.isPrimary ? "Phụ trách chính" : "Hỗ trợ"}
                          </li>)}</ul> : <p className="muted">Chờ cập nhật</p>}
                        </section>;
                      })}
                  </div>
                </section>
              )}
              {detailPage && selected && activeTab === "operations" && (
                !selected.concept && submittedSchedules.length > 0
                  ? <SubmittedCampaignSchedule selected={selected} submittedDetails={submittedDetails}
                    submittedSchedules={submittedSchedules} submittedStops={submittedStops} />
                  : <CampaignOperationsOverview campaign={selected} />
              )}
              {detailPage && selected && activeTab === "budget" && (
                selected.concept ? <CampaignBudgetOverview campaignId={selected.id}
                  planning={["PLANNING", "PENDING_FINAL_REVIEW", "FINAL_APPROVED", "FINAL_REJECTED", "PUBLISHED"].includes(selected.status)} /> :
                  <SubmittedCampaignBudget selected={selected} submittedDetails={submittedDetails} />
              )}
              {publishedEditable && editingSelected && showInformation && (
                <p className="notice">
                  Chiến dịch đã được duyệt: được sửa tên và mô tả; các thông tin quan trọng đã khóa.
                </p>
              )}
              {creating && (
                <CampaignWizard
                  organizationId={id}
                  draft={selected}
                  onBusyChange={setBusy}
                  onSaved={finishDraft}
                />
              )}
              {editingSelected && showInformation && (
                <form onSubmit={(e) => void save(e)}>
                  <fieldset className={managementStyles.conceptForm} disabled={busy || !publishedEditable}>
                    <CampaignEditFields
                      busy={busy}
                      publishedEditable={publishedEditable}
                      selected={selected}
                      setEditingSelected={setEditingSelected}
                    />
                  </fieldset>
                </form>
              )}
              {showInformation && !creating && selected?.concept && !editingSelected && (
                <CampaignConceptDetails
                  campaign={selected}
                  mediaPreviews={mediaPreviews}
                />
              )}
              {showInformation && !creating && selected && !selected.concept && !editingSelected && (
                <SubmittedCampaignDetails
                  action={action}
                  busy={busy}
                  mediaPreviews={mediaPreviews}
                  selected={selected}
                  submittedDetails={submittedDetails}
                />
              )}
              {workflowPage && canReviewSelected && (
                <OwnerReviewPanel busy={busy} note={note} setNote={setNote} reviewCampaign={reviewCampaign} />
              )}
              {createPage && !creating && selected && (
                <div className="actions">
                  <Link className="button" href={`${campaignsPath}/${selected.id}`}>Xem chi tiết</Link>
                  <Link className="button secondary" href={campaignsPath}>Về danh sách chiến dịch và sự kiện</Link>
                </div>
              )}
              {selected && editingSelected && showInformation && (
                <CampaignAttachments
                  action={action}
                  busy={busy}
                  mediaPreviews={mediaPreviews}
                  publishedEditable={publishedEditable}
                  selected={selected}
                  setMessage={setMessage}
                  setSelected={setSelected}
                />
              )}
            </section>
          </div>
        )}
      </>
    </LocalizedTree>
  );
}
