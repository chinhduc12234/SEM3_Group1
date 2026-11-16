"use client";

import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useCampaignManagement } from "./hooks/useCampaignManagement";
import CampaignList from "./components/CampaignList";
import OwnerReviewPanel from "./components/OwnerReviewPanel";
import { CampaignViewControls, CampaignViewNavigation } from "./components/CampaignStepper";
import CampaignEditFields from "./components/CampaignEditFields";
import SubmittedCampaignDetails from "./components/SubmittedCampaignDetails";
import CampaignAttachments from "./components/CampaignAttachments";
import CampaignWizard from "./CampaignWizard";

export default function CampaignManagementScreen({ createPage = false }: { createPage?: boolean }) {
  const model = useCampaignManagement(createPage);
  const {
    action,
    busy,
    canReviewSelected,
    creating,
    editable,
    editingSelected,
    error,
    id,
    manager,
    mediaPreviews,
    message,
    note,
    viewCampaign,
    editCampaign,
    deleteCampaign,
    reviewCampaign,
    openWizardForEdit,
    owner,
    page,
    pageSize,
    publishedEditable,
    router,
    rows,
    save,
    search,
    selected,
    selectedCanEdit,
    setCreating,
    setEditingSelected,
    setMessage,
    setNote,
    setPage,
    setSearch,
    setSelected,
    setStatusFilter,
    setStep,
    setViewing,
    statusFilter,
    step,
    submittedDetails,
    submittedSchedules,
    submittedStops,
    viewing,
  } = model;
  if (!manager && !owner)
    return (
      <LocalizedTree>
        <p className="notice">Bạn cần quyền Quản lý chiến dịch hoặc Owner.</p>
      </LocalizedTree>
    );
  return (
    <LocalizedTree>
      <>
        {createPage && message && (
          <p className="notice success" role="status">
            {message}
          </p>
        )}
        {!createPage && (
          <>
            <h1>Chiến dịch của tổ chức</h1>
            <p>Quản lý chiến dịch tạo bản nháp → Owner xét duyệt → công khai.</p>
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
            {manager && (
              <button
                disabled={busy}
                onClick={() => router.push(`/organizations/${id}/manage/campaigns/create`)}
              >
                Tạo chiến dịch
              </button>
            )}
            <CampaignList
              deleteCampaign={deleteCampaign}
              busy={busy}
              manager={manager}
              viewCampaign={viewCampaign}
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
            />
          </>
        )}
        {(creating || selected) && (
          <div
            className={creating && !createPage ? managementStyles.campaignOverlay : undefined}
            onKeyDown={(e) => {
              if (creating && !createPage && e.key === "Escape") {
                setCreating(false);
                setSelected(null);
                setViewing(false);
                setEditingSelected(false);
              }
            }}
          >
            <section
              className={
                creating
                  ? `panel ${createPage ? managementStyles.campaignPage : managementStyles.campaignDialog}`
                  : "panel"
              }
              role={creating && !createPage ? "dialog" : undefined}
              aria-modal={creating && !createPage ? true : undefined}
              aria-labelledby={creating ? "campaign-create-title" : undefined}
              key={selected?.id || "new"}
            >
              {creating && (
                <button
                  type="button"
                  className={`secondary ${managementStyles.campaignClose}`}
                  aria-label="Đóng biểu mẫu chiến dịch"
                  onClick={() => {
                    if (createPage) {
                      router.push(`/organizations/${id}/manage/campaigns`);
                      return;
                    }
                    setCreating(false);
                    setSelected(null);
                    setEditingSelected(false);
                    setViewing(false);
                  }}
                >
                  ✕
                </button>
              )}
              <h2 id={creating ? "campaign-create-title" : undefined}>
                {viewing && selected
                  ? `Chi tiết chiến dịch: ${selected.title}`
                  : creating && selected
                    ? `Chỉnh sửa chiến dịch: ${selected.title}`
                    : selected?.title || "Tạo chiến dịch mới"}
              </h2>
              <p>Loại: COMBINED — Quyên góp và tình nguyện</p>
              {publishedEditable && !viewing && (
                <p className="notice">
                  Chiến dịch đã được duyệt: được sửa tên và mô tả; các thông tin quan trọng đã khóa.
                </p>
              )}
              {viewing && canReviewSelected && (
                <OwnerReviewPanel
                  busy={busy}
                  note={note}
                  setNote={setNote}
                  reviewCampaign={reviewCampaign}
                />
              )}
              {viewing && <CampaignViewNavigation setStep={setStep} step={step} />}
              <form
                className={viewing ? managementStyles.campaignViewOnly : undefined}
                onSubmit={(e) => {
                  if (creating) {
                    e.preventDefault();
                    return;
                  }
                  void save(e);
                }}
              >
                <fieldset
                  disabled={busy || viewing || (!editable && !publishedEditable)}
                  style={{ border: 0, padding: 0 }}
                >
                  {creating ? (
                    <CampaignWizard model={model} />
                  ) : editingSelected ? (
                    <CampaignEditFields
                      busy={busy}
                      publishedEditable={publishedEditable}
                      selected={selected}
                      setEditingSelected={setEditingSelected}
                    />
                  ) : null}
                </fieldset>
              </form>
              {viewing && <CampaignViewControls setStep={setStep} step={step} />}
              {!creating && selected && !editingSelected && (
                <SubmittedCampaignDetails
                  action={action}
                  busy={busy}
                  mediaPreviews={mediaPreviews}
                  openWizardForEdit={openWizardForEdit}
                  selected={selected}
                  selectedCanEdit={selectedCanEdit}
                  setEditingSelected={setEditingSelected}
                  submittedDetails={submittedDetails}
                  submittedSchedules={submittedSchedules}
                  submittedStops={submittedStops}
                />
              )}
              {selected && editingSelected && (
                <CampaignAttachments
                  action={action}
                  busy={busy}
                  canReviewSelected={canReviewSelected}
                  editable={editable}
                  manager={manager}
                  mediaPreviews={mediaPreviews}
                  note={note}
                  publishedEditable={publishedEditable}
                  selected={selected}
                  setMessage={setMessage}
                  setNote={setNote}
                  setSelected={setSelected}
                  viewing={viewing}
                />
              )}
            </section>
          </div>
        )}
      </>
    </LocalizedTree>
  );
}
