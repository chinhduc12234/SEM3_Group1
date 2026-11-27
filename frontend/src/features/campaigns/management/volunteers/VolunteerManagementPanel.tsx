"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/shared/api/api";
import { Stat, StatGrid, StatusPill } from "@/shared/ui/StatusVisuals";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { WorkspaceEmpty, WorkspaceIcon, WorkspaceLoading } from "@/features/organizations/workspace/components/WorkspaceUI";
import ops from "../operations/OperationsDashboard.module.css";
import VolunteerGroupsPane from "./VolunteerGroupsPane";
import VolunteerApplicantProfile from "./VolunteerApplicantProfile";
import RemoveVolunteerDialog from "./RemoveVolunteerDialog";
import { applicationStatuses, type GroupMember, type GroupsView, type Pane, type RegistrationDetail, type RegistrationPage } from "./volunteerManagementTypes";
import styles from "./VolunteerManagementPanel.module.css";

export default function VolunteerManagementPanel({ campaignId }: { campaignId: string }) {
  const { locale, t } = useLocale();
  const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { dateStyle: "medium", timeZone: "UTC" });
  const [pane, setPane] = useState<Pane>("groups");
  const [status, setStatus] = useState("SUBMITTED");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<GroupsView>();
  const [members, setMembers] = useState<GroupMember[]>();
  const [selectedGroup, setSelectedGroup] = useState("");
  const [applications, setApplications] = useState<RegistrationPage>();
  const [selectedRegistration, setSelectedRegistration] = useState("");
  const [loadedDetail, setDetail] = useState<RegistrationDetail>();
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applicationError, setApplicationError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const statusId = useId();
  const detailPanel = useRef<HTMLElement>(null);
  const removalDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<GroupsView>(`/api/volunteers/campaigns/${campaignId}/groups`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setView(result);
        setSelectedGroup((current) => result.groups.some((group) => group.id === current) ? current : result.groups[0]?.id ?? "");
      })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [campaignId, reload]);

  useEffect(() => {
    if (!selectedGroup) { setMembers([]); return; }
    const controller = new AbortController();
    setMembers(undefined);
    api<GroupMember[]>(`/api/volunteers/campaigns/${campaignId}/groups/${selectedGroup}/members`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setMembers(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [campaignId, selectedGroup, reload]);

  useEffect(() => {
    if (pane !== "applications") return;
    const controller = new AbortController();
    setApplications(undefined);
    setApplicationError("");
    api<RegistrationPage>(`/api/volunteers/campaigns/${campaignId}/registrations?status=${status}&page=${page}&pageSize=12`,
      { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
        if (page > lastPage) { setPage(lastPage); return; }
        setApplications(result);
        setSelectedRegistration((current) => result.items.some((item) => item.id === current) ? current : result.items[0]?.id ?? "");
      })
      .catch((failure: Error) => { if (!controller.signal.aborted) setApplicationError(failure.message); });
    return () => controller.abort();
  }, [campaignId, pane, status, page, reload]);

  useEffect(() => {
    setReviewError("");
    if (!selectedRegistration) { setDetail(undefined); return; }
    const controller = new AbortController();
    setDetail(undefined);
    api<RegistrationDetail>(`/api/volunteers/registrations/${selectedRegistration}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setDetail(result);
        // Preferences guide the reviewer; require an explicit final assignment.
        setAssignedGroupIds(result.assignedGroups.filter((item) => item.status === "ACTIVE").map((item) => item.groupId));
        setReviewNote("");
      })
      .catch((failure: Error) => { if (!controller.signal.aborted) setReviewError(failure.message); });
    return () => controller.abort();
  }, [selectedRegistration, reload]);

  const currentApplications = applications?.status === status && applications.page === page ? applications : undefined;
  const applicant = currentApplications?.items.find((item) => item.id === selectedRegistration);
  const detail = applicant && loadedDetail?.id === applicant.id ? loadedDetail : undefined;
  const fullGroups = view?.groups.filter((group) => group.remaining === 0).length ?? 0;
  const shortfall = view?.groups.reduce((sum, group) => sum + group.remaining, 0) ?? 0;

  async function review(decision: "APPROVE" | "WAITLIST" | "REJECT") {
    if (!detail || busy) return;
    setReviewError("");
    setNotice("");
    if (decision === "APPROVE" && assignedGroupIds.length === 0) {
      setReviewError("Hãy phân công ít nhất một nhóm trước khi duyệt hồ sơ.");
      return;
    }
    if (decision === "REJECT" && !reviewNote.trim()) {
      setReviewError("Hãy ghi lý do từ chối hồ sơ.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/volunteers/registrations/${detail.id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, assignedGroupIds: decision === "APPROVE" ? assignedGroupIds : [], note: reviewNote }),
      });
      setNotice(decision === "APPROVE" ? "Đã duyệt hồ sơ và phân nhóm." : decision === "WAITLIST" ? "Đã đưa hồ sơ vào danh sách chờ." : "Đã từ chối hồ sơ.");
      setSelectedRegistration("");
      setReload((value) => value + 1);
      detailPanel.current?.focus();
    } catch (failure) {
      setReviewError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeApplication() {
    if (!detail || busy) return;
    setBusy(true);
    setRemoveError("");
    setNotice("");
    try {
      await api<void>(`/api/volunteers/registrations/${detail.id}`, { method: "DELETE" });
      removalDialog.current?.close();
      setNotice("Đã xóa hồ sơ tình nguyện khỏi chiến dịch.");
      setApplications(undefined);
      setSelectedRegistration("");
      setReload((value) => value + 1);
      detailPanel.current?.focus();
    } catch (failure) {
      setRemoveError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <LocalizedTree><section className={styles.panel} aria-labelledby="volunteer-management-title">
    <header className={styles.heading}>
      <div><h2 id="volunteer-management-title">Điều phối tình nguyện</h2>
        <p>Theo dõi chỉ tiêu nhóm và xét duyệt hồ sơ đăng ký.</p></div>
      <button type="button" className="secondary" disabled={busy} onClick={() => setReload((value) => value + 1)}><WorkspaceIcon name="refresh" />Làm mới</button>
    </header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!view && !error && <WorkspaceLoading>Đang tải nhóm và chỉ tiêu…</WorkspaceLoading>}
    {view && <>
      <StatGrid label={t("Tổng quan tuyển tình nguyện")}>
        <Stat label={t("Đã xác nhận ca")} value={view.groups.reduce((sum, group) => sum + group.confirmedCount, 0)} tone="positive" icon={<WorkspaceIcon name="check" />} />
        <Stat label={t("Nhóm đã xếp đủ")} value={`${fullGroups}/${view.groups.length}`} tone="info" icon={<WorkspaceIcon name="people" />} />
        <Stat label={t("Suất chưa xếp")} value={shortfall} icon={<WorkspaceIcon name="calendar" />} />
        <Stat label={t("Hồ sơ chờ duyệt")} value={view.pendingRegistrations} tone={view.pendingRegistrations ? "warning" : "neutral"} icon={<WorkspaceIcon name="file" />} />
      </StatGrid>
      <div className={ops.tabs} role="group" aria-label="Quản lý tình nguyện viên">
        <button type="button" aria-pressed={pane === "groups"} disabled={busy}
          className="quiet" onClick={() => setPane("groups")}><WorkspaceIcon name="people" />Nhóm và thành viên</button>
        <button type="button" aria-pressed={pane === "applications"} disabled={busy}
          className="quiet" onClick={() => setPane("applications")}><WorkspaceIcon name="file" />Duyệt hồ sơ
          <span>{view.pendingRegistrations}</span></button>
      </div>

      {pane === "groups" && <VolunteerGroupsPane groups={view.groups} selectedGroup={selectedGroup}
        onSelectGroup={setSelectedGroup} members={members} error={error} dateFormat={dateFormat} />}

      {pane === "applications" && <div className={styles.reviewLayout}>
        <section className={styles.applicationList} aria-label="Hồ sơ tình nguyện">
          <header><h3>Hồ sơ đăng ký</h3>
            {currentApplications && <span role="status"><StatusPill>{t(`${currentApplications.totalCount} hồ sơ`)}</StatusPill></span>}
          </header>
          <div className={styles.statusFilter}><label htmlFor={statusId}>Trạng thái</label><select id={statusId} value={status} disabled={busy} onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
            setSelectedRegistration("");
            setNotice("");
          }}>
            {Object.entries(applicationStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></div>
          <div className={styles.applicants}>
            {currentApplications?.items.map((item) => <button type="button" key={item.id} disabled={busy}
              aria-pressed={selectedRegistration === item.id} className={`quiet ${styles.applicant}`}
              onClick={() => {
                setSelectedRegistration(item.id);
                setNotice("");
                if (window.matchMedia("(max-width: 1080px)").matches) detailPanel.current?.focus();
              }}>
              <span className={styles.avatar} aria-hidden="true">{item.fullName.trim().charAt(0).toUpperCase()}</span>
              <span className={styles.applicantCopy}><strong>{item.fullName}</strong><small>{item.email}</small>
                <small>{item.groupPreferences.length} {t("nhóm quan tâm")} · {dateFormat.format(new Date(item.submittedAt))}</small>
              </span>
            </button>)}
          </div>
          {currentApplications && currentApplications.totalCount > currentApplications.pageSize && <nav className={styles.pagination} aria-label="Phân trang hồ sơ">
            <button type="button" className="secondary" disabled={busy || page === 1} onClick={() => { setSelectedRegistration(""); setPage(page - 1); }}>Trước</button>
            <span>{page} / {Math.ceil(currentApplications.totalCount / currentApplications.pageSize)}</span>
            <button type="button" className="secondary" disabled={busy || page * currentApplications.pageSize >= currentApplications.totalCount}
              onClick={() => { setSelectedRegistration(""); setPage(page + 1); }}>Sau</button>
          </nav>}
          {currentApplications?.items.length === 0 && <WorkspaceEmpty title="Không có hồ sơ ở trạng thái này." />}
          {!currentApplications && !applicationError && <WorkspaceLoading>Đang tải hồ sơ…</WorkspaceLoading>}
          {applicationError && <p role="alert" className="notice error">{applicationError} <button type="button" className="quiet" onClick={() => setReload((value) => value + 1)}>Tải lại</button></p>}
        </section>
        <section ref={detailPanel} className={styles.reviewDetail} tabIndex={-1} aria-label="Chi tiết xét duyệt">
          {notice && <p className="notice success" role="status">{notice}</p>}
          {detail ? <>
            <VolunteerApplicantProfile detail={detail} dateFormat={dateFormat} />
            {detail.status !== "REJECTED" && <>
            <fieldset disabled={busy} className={styles.assignFieldset}><legend>Phân công nhóm khi duyệt</legend>
              <p>Chọn nhóm để phân công. Nhãn Nguyện vọng cho biết nhóm mà ứng viên đã chọn khi đăng ký.</p>
              {view.groups.map((group) => {
                const checked = assignedGroupIds.includes(group.id);
                const previouslyAssigned = detail.assignedGroups.some((item) => item.groupId === group.id && item.status === "ACTIVE");
                const full = group.remaining === 0 && !previouslyAssigned;
                return <label key={group.id}><input type="checkbox" disabled={full} checked={checked}
                  onChange={(event) => setAssignedGroupIds((current) => event.target.checked
                    ? [...current, group.id] : current.filter((id) => id !== group.id))} />
                  <span><strong>{group.name}</strong><small>
                    {detail.groupPreferences.some((item) => item.groupId === group.id) && <span>Nguyện vọng</span>}
                    <span>{group.assignedCount}/{group.target}</span>{full && <span>Đã đủ</span>}
                  </small></span>
                </label>;
              })}
              {view.groups.length === 0 && <p>Chưa có nhóm để phân công.</p>}
            </fieldset>
            <label className={styles.noteLabel}>Ghi chú / lý do từ chối<textarea rows={3} maxLength={2000} disabled={busy}
              value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label>
            </>}
            {reviewError && <p className="notice error" role="alert">{reviewError}</p>}
            <div className={styles.reviewActions}>
              <button type="button" className={`secondary ${styles.rejectButton} ${styles.removeButton}`} disabled={busy}
                onClick={() => { setRemoveError(""); removalDialog.current?.showModal(); }}>Xóa hồ sơ</button>
              {detail.status !== "APPROVED" && detail.status !== "REJECTED" && <>
                <button type="button" className="secondary" disabled={busy} onClick={() => void review("WAITLIST")}>Đưa vào danh sách chờ</button>
                <button type="button" className={`secondary ${styles.rejectButton}`} disabled={busy} onClick={() => void review("REJECT")}>Từ chối</button>
              </>}
              {detail.status !== "REJECTED" && <button type="button" disabled={busy} onClick={() => void review("APPROVE")}>
                {busy ? "Đang lưu…" : detail.status === "APPROVED" ? "Cập nhật nhóm" : "Duyệt và phân nhóm"}</button>}
            </div>
            <RemoveVolunteerDialog dialog={removalDialog} name={detail.fullName} busy={busy}
              error={removeError} onRemove={removeApplication} />
          </> : reviewError ? <p className="notice error" role="alert">{reviewError} <button type="button" className="quiet" onClick={() => setReload((value) => value + 1)}>Tải lại</button></p>
            : applicant ? <WorkspaceLoading>Đang tải chi tiết hồ sơ…</WorkspaceLoading>
            : <WorkspaceEmpty title="Chọn hồ sơ để xem chi tiết và xét duyệt." icon="file" />}
        </section>
      </div>}
    </>}
  </section></LocalizedTree>;
}
