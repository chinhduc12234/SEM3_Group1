"use client";

import { useEffect, useId, useState } from "react";
import { type Invitation, type Member, memberRoles } from "@/features/organizations/types/workspace";
import { api } from "@/shared/api/api";
import type { PageResult } from "@/shared/api/pagination";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { Stat, StatGrid } from "@/shared/ui/StatusVisuals";
import { WorkspaceEmpty, WorkspaceHero, WorkspaceIcon, WorkspaceLoading } from "../components/WorkspaceUI";
import { Avatar, Roles } from "./MemberIdentity";
import PersonnelDetail from "./PersonnelDetail";
import PersonnelEditor from "./PersonnelEditor";
import type { Detail, Editor, Personnel, ProfileResult } from "./memberProfiles";
import styles from "./WorkspaceMembers.module.css";

type Tab = "members" | "invitations";
const invitationStates: Record<string, string> = {
  PENDING: "Chờ chấp nhận",
  ACCEPTED: "Đã tham gia",
  DECLINED: "Đã từ chối",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Đã hết hạn",
};
const displayRoles = Object.keys(memberRoles).filter((role) => role !== "SURVEY_STAFF");

function Pagination({
  result, onPage,
}: {
  result: Pick<PageResult<unknown>, "totalCount" | "page" | "pageSize">;
  onPage: (page: number) => void;
}) {
  const { page, pageSize, totalCount } = result;
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <LocalizedTree>
      <div className={styles.pagination}>
        <span>{totalCount ? `${(page - 1) * pageSize + 1}–${Math.min(totalCount, page * pageSize)} / ${totalCount}` : "0 kết quả"}</span>
        <div>
          <button type="button" className="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Trang trước</button>
          <span aria-label="Trang hiện tại">{page} / {pages}</span>
          <button type="button" className="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Trang sau</button>
        </div>
      </div>
    </LocalizedTree>
  );
}

function accessStatus(record: Pick<Member, "userId" | "isActive" | "accountActive">) {
  if (!record.userId) return "Chưa liên kết tài khoản";
  if (!record.isActive) return "Đã thu hồi quyền";
  return record.accountActive ? "Đang hoạt động" : "Tài khoản không hoạt động";
}

export default function WorkspaceMembers({
  id, canManage = false, inviteRoles = [], onChange, heading: Heading = "h2", ownerStats,
}: {
  id: string;
  canManage?: boolean;
  inviteRoles?: string[];
  onChange?: () => Promise<void>;
  heading?: "h1" | "h2";
  ownerStats?: { activeMembers: number; staffCount: number; pendingInvitations: number };
}) {
  const { locale, t } = useLocale();
  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<PageResult<Member> | null>(null);
  const [invitations, setInvitations] = useState<PageResult<Invitation> | null>(null);
  const [page, setPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);
  const pageSize = 10;
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const searchId = useId();
  const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN");
  const date = (value: string) => dateFormat.format(new Date(value));
  const allowed = inviteRoles.filter((role) => displayRoles.includes(role) && role !== "OWNER");
  const activeTab = allowed.length ? tab : "members";
  const title = Heading === "h1" && !canManage ? "Danh bạ nội bộ" : "Nhân sự";
  const description = canManage ? "Quản lý hồ sơ, vai trò và quyền truy cập của thành viên trong tổ chức." : "Danh sách thành viên và vai trò trong tổ chức.";
  const base = `/api/organizations/${id}/workspace`;
  const filters = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) filters.set("search", search);
  if (role) filters.set("role", role);
  if (status) filters.set("status", status);
  const query = activeTab === "members" ? `members?${filters}` : `invitations?page=${invitePage}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    if (activeTab === "members") {
      setMembers(null);
      api<PageResult<Member>>(`${base}/${query}`, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          const lastPage = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
          if (result.page > lastPage) setPage(lastPage);
          else setMembers(result);
        })
        .catch((ex) => { if (!controller.signal.aborted) setLoadError(ex.message); });
    } else {
      setInvitations(null);
      api<PageResult<Invitation>>(`${base}/${query}`, { signal: controller.signal })
        .then((result) => { if (!controller.signal.aborted) setInvitations(result); })
        .catch((ex) => { if (!controller.signal.aborted) setLoadError(ex.message); });
    }
    return () => controller.abort();
  }, [activeTab, base, query, revision]);

  function startAction() {
    setError("");
    setMessage("");
  }

  function updated(text: string) {
    setMessage(text);
    setRevision((current) => current + 1);
    void onChange?.().catch((ex: Error) => setError(ex.message));
  }

  async function openProfile(member: Member, mode: "view" | "edit") {
    startAction();
    setBusy(true);
    try {
      const profile = await api<ProfileResult>(`${base}/members/${member.id}/profile`);
      if (mode === "edit") setEditor({ kind: "edit", member, profile });
      else setDetail({ member, profile });
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(roles: string[], profile: Personnel) {
    if (!editor) return;
    if (editor.kind === "create") {
      await api(`${base}/members`, { method: "POST", body: JSON.stringify({ roles, profile }) });
      clearFilters();
      setTab("members");
      updated("Đã tạo hồ sơ nhân sự.");
    } else {
      await api(`${base}/members/${editor.member.id}/profile`, {
        method: "PUT",
        body: JSON.stringify({ roles, profile, version: editor.profile.version }),
      });
      updated("Đã cập nhật hồ sơ nhân sự.");
    }
    setEditor(null);
  }

  async function invite(email: string) {
    if (!detail) return;
    await api(`${base}/invitations`, {
      method: "POST", body: JSON.stringify({ email, roles: detail.profile.roles, memberId: detail.member.id }),
    });
    setDetail(null);
    setInvitePage(1);
    setTab("invitations");
    updated("Đã gửi lời mời liên kết tài khoản.");
  }

  async function changeState() {
    if (!detail) return;
    const { member, profile } = detail;
    if (!window.confirm(t(profile.isActive ? "Thu hồi quyền truy cập tổ chức của thành viên này?" : "Khôi phục quyền truy cập tổ chức của thành viên này?"))) return;
    await api(`${base}/members/${member.id}/state`, {
      method: "PUT", body: JSON.stringify({ isActive: !profile.isActive, version: profile.version }),
    });
    setDetail(null);
    updated(profile.isActive ? "Đã thu hồi quyền truy cập của thành viên." : "Đã khôi phục quyền truy cập của thành viên.");
  }

  async function remove(member: Member) {
    if (!window.confirm(t("Xóa hồ sơ nhân sự này và thu hồi quyền của thành viên trong tổ chức?"))) return;
    startAction();
    setBusy(true);
    try {
      await api(`${base}/members/${member.id}?version=${encodeURIComponent(member.version)}`, { method: "DELETE" });
      updated("Đã xóa hồ sơ nhân sự.");
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: Invitation) {
    if (!window.confirm(t("Thu hồi lời mời này?"))) return;
    startAction();
    setBusy(true);
    try {
      await api(`${base}/invitations/${item.id}/revoke`, { method: "POST", body: JSON.stringify({ version: item.version }) });
      updated("Đã thu hồi lời mời.");
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setInput("");
    setSearch("");
    setRole("");
    setStatus("");
    setPage(1);
  }

  return (
    <LocalizedTree>
      <section className={`${styles.directory} ${ownerStats ? styles.ownerDirectory : ""}`} aria-label="Quản lý nhân sự">
        {Heading === "h1" ? <WorkspaceHero title={title} description={description} icon="people">
          {canManage && <button type="button" className="secondary" disabled={busy} onClick={() => { startAction(); setEditor({ kind: "create" }); }}>
            <span aria-hidden="true">＋</span> Thêm nhân sự
          </button>}
        </WorkspaceHero> : <header className={styles.header}><div><Heading>{title}</Heading><p>{description}</p></div></header>}

        {ownerStats && (
          <div className={styles.memberStats}><StatGrid label={t("Tổng quan nhân sự")}>
            <Stat label={t("Thành viên đang hoạt động")} value={ownerStats.activeMembers} tone="positive" icon={<WorkspaceIcon name="people" />} />
            <Stat label={t("Đội ngũ nhân sự")} value={ownerStats.staffCount} detail={t("Không bao gồm chủ tổ chức")} tone="info" icon={<WorkspaceIcon name="building" />} />
            <Stat label={t("Lời mời đang chờ")} value={ownerStats.pendingInvitations} tone={ownerStats.pendingInvitations ? "warning" : "neutral"} icon={<WorkspaceIcon name="clock" />} />
          </StatGrid></div>
        )}

        {message && <p className="notice success" role="status">{message}</p>}
        {error && <p className="notice error" role="alert">{error}</p>}

        <div className={styles.surface}>
          {Heading === "h1" && <header className={styles.listHeader}><h2>{activeTab === "members" ? "Danh sách thành viên" : "Lời mời"}</h2>
            {activeTab === "members" && members && <span role="status">{members.totalCount} thành viên</span>}</header>}
          {allowed.length > 0 && (
            <div className={styles.tabs} role="group" aria-label="Danh mục nhân sự">
              <button type="button" className="quiet" aria-pressed={activeTab === "members"} onClick={() => setTab("members")}>Thành viên</button>
              <button type="button" className="quiet" aria-pressed={activeTab === "invitations"} onClick={() => setTab("invitations")}>Lời mời</button>
            </div>
          )}

          {activeTab === "members" && (
            <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); setSearch(input.trim()); setPage(1); }}>
              <div className={styles.search}>
                <label htmlFor={searchId}>Tìm kiếm</label>
                <span>
                  <i className={styles.searchIcon}><WorkspaceIcon name="search" /></i>
                  <input id={searchId} type="search" maxLength={120} value={input} onChange={(event) => {
                    setInput(event.target.value);
                    if (!event.target.value) { setSearch(""); setPage(1); }
                  }} placeholder={canManage ? "Tên, email hoặc số điện thoại" : "Tên thành viên"} />
                  <button type="submit" className="secondary">Tìm</button>
                </span>
              </div>
              <label>
                Vai trò
                <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}>
                  <option value="">Tất cả vai trò</option>
                  {displayRoles.map((key) => <option key={key} value={key}>{memberRoles[key]}</option>)}
                </select>
              </label>
              <label>
                Quyền trong tổ chức
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                  <option value="">Tất cả trạng thái</option>
                  {canManage && <option value="UNLINKED">Chưa liên kết tài khoản</option>}
                  <option value="ACTIVE">Đang cấp quyền</option>
                  <option value="SUSPENDED">Đã thu hồi quyền</option>
                </select>
              </label>
              {(input || search || role || status) && <button type="button" className="quiet" onClick={clearFilters}>Xóa bộ lọc</button>}
            </form>
          )}

          {loadError ? (
            <div className={styles.empty} role="alert">
              <p>{loadError}</p>
              <button type="button" className="secondary" onClick={() => setRevision((value) => value + 1)}>Tải lại</button>
            </div>
          ) : activeTab === "members" ? (
              !members ? <WorkspaceLoading>Đang tải nhân sự…</WorkspaceLoading> : (
              <>
                {members.items.length === 0 ? (
                  <WorkspaceEmpty title="Không tìm thấy thành viên" detail="Thử từ khóa khác hoặc điều chỉnh bộ lọc." icon="search" />
                ) : (
                  <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Danh sách thành viên">
                    <table className={styles.table} role="table" data-readonly={!canManage || undefined}>
                      <thead role="rowgroup"><tr role="row">
                        <th scope="col">Thành viên</th>
                        {canManage && <th scope="col">Điện thoại</th>}
                        <th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Ngày thêm</th>
                        {canManage && <th scope="col">Thao tác</th>}
                      </tr></thead>
                      <tbody role="rowgroup">
                        {members.items.map((member) => (
                          <tr key={member.id} role="row">
                            <td role="cell">
                              <div className={styles.person}>
                                <Avatar name={member.fullName} photo={member.photo} />
                                <div><strong>{member.fullName}</strong>{member.email && <small>{member.email}</small>}</div>
                              </div>
                            </td>
                            {canManage && <td className={styles.nowrap}>{member.phone || "—"}</td>}
                            <td role="cell"><Roles roles={member.roles} /></td>
                            <td role="cell">
                              <span className={styles.status} data-state={!member.userId ? "pending" : member.isActive && member.accountActive ? "active" : "inactive"}>
                                {accessStatus(member)}
                              </span>
                            </td>
                            <td role="cell" className={styles.nowrap}><time dateTime={member.joinedAt}>{date(member.joinedAt)}</time></td>
                            {canManage && (
                              <td>
                                <div className={styles.rowActions}>
                                  <button type="button" className="secondary" disabled={busy} onClick={() => void openProfile(member, "view")}>Xem chi tiết</button>
                                  {!member.roles.includes("OWNER") && (
                                    <>
                                      <button type="button" className="secondary" disabled={busy} onClick={() => void openProfile(member, "edit")}>Cập nhật</button>
                                      <button type="button" className={`quiet ${styles.deleteAction}`} disabled={busy} onClick={() => void remove(member)}>Xóa</button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination result={members} onPage={setPage} />
              </>
            )
          ) : !invitations ? <p className={styles.empty} role="status">Đang tải lời mời…</p> : (
            <>
              {invitations.items.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr>
                      <th scope="col">Người nhận</th><th scope="col">Vai trò được mời</th><th scope="col">Trạng thái</th>
                      <th scope="col">Hết hạn</th><th scope="col">Thao tác</th>
                    </tr></thead>
                    <tbody>
                      {invitations.items.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.fullName || item.email}</strong><small>{item.email}</small></td>
                          <td><Roles roles={item.roles} /></td>
                          <td><span className={styles.status} data-state={item.state === "ACCEPTED" ? "active" : item.state === "PENDING" ? "pending" : "inactive"}>{invitationStates[item.state] ?? item.state}</span></td>
                          <td className={styles.nowrap}>{date(item.expiresAt)}</td>
                          <td>{item.state === "PENDING" && <button type="button" className="secondary" disabled={busy} onClick={() => void revoke(item)}>Thu hồi lời mời</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className={styles.empty}><strong>Chưa có lời mời</strong><p>Mở chi tiết một hồ sơ nhân sự để mời liên kết tài khoản.</p></div>}
              <Pagination result={invitations} onPage={setInvitePage} />
            </>
          )}
        </div>
        {editor && <PersonnelEditor editor={editor} allowed={allowed} onSave={save} onClose={() => setEditor(null)} />}
        {detail && <PersonnelDetail detail={detail} onInvite={invite} onChangeState={changeState} onClose={() => setDetail(null)} />}
      </section>
    </LocalizedTree>
  );
}
