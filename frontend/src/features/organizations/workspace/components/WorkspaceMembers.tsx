"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { type Invitation, type Member, memberRoles } from "@/features/organizations/types/workspace";
import { api } from "@/shared/api/api";
import type { PageResult } from "@/shared/api/pagination";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import styles from "./WorkspaceMembers.module.css";

type Personnel = { fullName: string; phone: string; identityNumber: string; photo: string };
type ProfileResult = { [K in keyof Personnel]: string | null } & {
  roles: string[];
  version: string;
  email: string | null;
  userId: string | null;
  isActive: boolean;
  accountActive: boolean;
};
type Editor = { kind: "create" } | { kind: "edit"; member: Member; profile: ProfileResult };
type Detail = { member: Member; profile: ProfileResult };
type Tab = "members" | "invitations";
const invitationStates: Record<string, string> = {
  PENDING: "Chờ chấp nhận",
  ACCEPTED: "Đã tham gia",
  DECLINED: "Đã từ chối",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Đã hết hạn",
};
const displayRoles = Object.keys(memberRoles).filter((role) => role !== "SURVEY_STAFF");

function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  const initials = name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
  return (
    <span className={styles.avatar} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initials}
    </span>
  );
}

function Roles({ roles }: { roles: string[] }) {
  return (
    <LocalizedTree>
      <div className={styles.roles}>
        {roles.map((role) => <span key={role}>{memberRoles[role] ?? role}</span>)}
      </div>
    </LocalizedTree>
  );
}

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

async function preparePhoto(file: File) {
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 10 * 1024 * 1024)
    throw new Error("Chọn ảnh JPG hoặc PNG có dung lượng tối đa 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 320;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không thể xử lý ảnh.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 320, 320);
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 320, 320);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

function PersonnelEditor({
  editor, allowed, onClose, onSave,
}: {
  editor: Editor;
  allowed: string[];
  onClose: () => void;
  onSave: (roles: string[], profile: Personnel) => Promise<void>;
}) {
  const edit = editor.kind === "edit" ? editor : null;
  const [profile, setProfile] = useState<Personnel>({
    fullName: edit?.profile.fullName ?? "",
    phone: edit?.profile.phone ?? "",
    identityNumber: edit?.profile.identityNumber ?? "",
    photo: edit?.profile.photo ?? "",
  });
  const [roles, setRoles] = useState(() => edit?.profile.roles.filter((role) => allowed.includes(role)) ?? []);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const update = (key: keyof Personnel, value: string) => setProfile((current) => ({ ...current, [key]: value }));
  const remaining = allowed.filter((role) => !roles.includes(role));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || readingPhoto || roles.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await onSave(roles, {
        ...profile, fullName: profile.fullName.trim(), phone: profile.phone.trim(), identityNumber: profile.identityNumber.trim(),
      });
    } catch (ex) {
      setError((ex as Error).message);
      setBusy(false);
    }
  }

  return (
    <LocalizedTree>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="personnel-form-title"
        onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      >
        <form onSubmit={submit} autoComplete="off">
          <div className={styles.dialogHead}>
            <div>
              <h2 id="personnel-form-title">{edit ? "Cập nhật nhân sự" : "Thêm nhân sự"}</h2>
            </div>
            <button type="button" className="secondary" disabled={busy} onClick={onClose} aria-label="Đóng">×</button>
          </div>
          <fieldset disabled={busy} className={styles.fields}>
            <div className={styles.photoField}>
              <Avatar name={profile.fullName || "Nhân sự"} photo={profile.photo} />
              <div>
                <strong className={styles.photoTitle}>Ảnh nhân sự</strong>
                <small className={styles.photoHelp}>Ảnh sẽ hiển thị cùng hồ sơ trong danh sách thành viên.</small>
                <label className={styles.fileLabel}>
                  {profile.photo ? "Đổi ảnh" : "Chọn ảnh"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    disabled={readingPhoto}
                    onChange={async (event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      setPhotoError("");
                      setReadingPhoto(true);
                      try {
                        update("photo", await preparePhoto(file));
                      } catch (ex) {
                        setPhotoError((ex as Error).message);
                      } finally {
                        setReadingPhoto(false);
                      }
                    }}
                  />
                </label>
                {profile.photo && <button type="button" className="quiet" disabled={readingPhoto} onClick={() => update("photo", "")}>Xóa ảnh</button>}
                {readingPhoto && <small role="status">Đang xử lý ảnh…</small>}
                {photoError && <small role="alert">{photoError}</small>}
              </div>
            </div>
            <div className={styles.formSectionTitle}>
              <span>01</span>
              <div><strong>Thông tin cá nhân</strong><small>Cập nhật thông tin liên hệ và nhận diện thành viên.</small></div>
            </div>
            <label>
              Họ và tên <span aria-hidden="true">*</span>
              <input required minLength={2} maxLength={120} value={profile.fullName} onChange={(event) => update("fullName", event.target.value)} placeholder="Nguyễn Văn An" />
            </label>
            <label>
              Số điện thoại
              <input type="tel" maxLength={26} value={profile.phone} onChange={(event) => update("phone", event.target.value)} placeholder="090 123 4567" />
              <small>Có thể để trống nếu chưa có số điện thoại.</small>
            </label>
            <label>
              Số CCCD
              <input
                inputMode="numeric"
                maxLength={12}
                pattern="[0-9]{12}"
                value={profile.identityNumber}
                onChange={(event) => update("identityNumber", event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="12 chữ số"
              />
              <small>Nhập đủ 12 chữ số nếu cần lưu thông tin CCCD.</small>
            </label>
            <div className={styles.fullField}>
              <div className={styles.formSectionTitle}>
                <span>02</span>
                <div><strong>Vai trò và quyền hạn</strong><small>Vai trò quyết định các khu vực mà thành viên có thể truy cập.</small></div>
              </div>
              <label>
                Vai trò trong tổ chức <span aria-hidden="true">*</span>
                <select
                  value=""
                  disabled={!remaining.length}
                  onChange={(event) => {
                    if (event.target.value) setRoles([...roles, event.target.value]);
                  }}
                >
                  <option value="">{remaining.length ? "Chọn vai trò" : "Đã chọn mọi vai trò có thể cấp"}</option>
                  {remaining.map((role) => <option value={role} key={role}>{memberRoles[role] ?? role}</option>)}
                </select>
              </label>
              {roles.length > 0 && (
                <div className={styles.selectedRoles}>
                  {roles.map((role) => (
                    <button type="button" className="secondary" key={role} onClick={() => setRoles(roles.filter((item) => item !== role))} aria-label={`Bỏ vai trò ${memberRoles[role] ?? role}`}>
                      {memberRoles[role] ?? role} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </fieldset>
          {error && <p className="notice error" role="alert">{error}</p>}
          <div className={styles.dialogActions}>
            <button type="button" className="secondary" disabled={busy} onClick={onClose}>Hủy</button>
            <button type="submit" disabled={busy || readingPhoto || !roles.length}>
              {busy ? "Đang lưu…" : edit ? "Lưu thay đổi" : "Tạo nhân sự"}
            </button>
          </div>
        </form>
      </dialog>
    </LocalizedTree>
  );
}

function accessStatus(record: Pick<Member, "userId" | "isActive" | "accountActive">) {
  if (!record.userId) return "Chưa liên kết tài khoản";
  if (!record.isActive) return "Đã thu hồi quyền";
  return record.accountActive ? "Đang hoạt động" : "Tài khoản không hoạt động";
}

function PersonnelDetail({
  detail, onClose, onInvite, onChangeState,
}: {
  detail: Detail;
  onClose: () => void;
  onInvite: (email: string) => Promise<void>;
  onChangeState: () => Promise<void>;
}) {
  const { member, profile } = detail;
  const { locale } = useLocale();
  const joinedAt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
    day: "2-digit", month: "long", year: "numeric",
  }).format(new Date(member.joinedAt));
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <LocalizedTree>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="personnel-detail-title"
        onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      >
        <div className={styles.dialogHead}>
          <div>
            <span className={styles.dialogEyebrow}>HỒ SƠ THÀNH VIÊN</span>
            <h2 id="personnel-detail-title">Chi tiết nhân sự</h2>
          </div>
          <button type="button" className="secondary" disabled={busy} onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className={styles.detailBody}>
          <section className={styles.detailProfileHero} aria-label="Thông tin thành viên">
            <div className={styles.photoField}>
              <Avatar name={profile.fullName || member.fullName} photo={profile.photo} />
              <div>
                <strong>{profile.fullName || member.fullName}</strong>
                <Roles roles={profile.roles} />
              </div>
            </div>
            <span className={styles.detailMemberState} data-state={!profile.userId ? "pending" : profile.isActive ? "active" : "inactive"}>
              <i aria-hidden="true" />
              {!profile.userId ? "Chưa liên kết tài khoản" : profile.isActive ? "Đang được cấp quyền" : "Đã thu hồi quyền"}
            </span>
          </section>
          <div className={styles.detailSectionLabel}><span>THÔNG TIN HỒ SƠ</span><i /></div>
          <dl className={styles.detailFields}>
            <div><dt>Số điện thoại</dt><dd>{profile.phone || "—"}</dd></div>
            <div><dt>Số CCCD</dt><dd>{profile.identityNumber || "—"}</dd></div>
            <div><dt>Email đăng nhập</dt><dd>{profile.email || (profile.userId ? "Không tìm thấy tài khoản" : "Chưa liên kết tài khoản")}</dd></div>
            <div><dt>Tình trạng tài khoản</dt><dd>{profile.userId ? profile.accountActive ? "Tài khoản đang hoạt động" : "Tài khoản không hoạt động" : "Chưa có tài khoản liên kết"}</dd></div>
            <div><dt>Quyền truy cập tổ chức</dt><dd>{profile.isActive ? "Đang được cấp quyền" : "Đã thu hồi quyền"}</dd></div>
            <div><dt>Ngày tham gia</dt><dd>{joinedAt}</dd></div>
          </dl>
          {profile.userId && (
            <p className={styles.passwordHint}><span aria-hidden="true">i</span><span><strong>Bảo mật tài khoản</strong>Mật khẩu được bảo vệ. Thành viên có thể đổi mật khẩu trong mục Bảo mật của tài khoản Give-AID.</span></p>
          )}
          {inviting && (
            <form className={styles.inviteForm} onSubmit={(event) => {
              event.preventDefault();
              void perform(() => onInvite(email.trim()));
            }}>
              <div className={styles.inviteHeading}><strong>Liên kết tài khoản Give-AID</strong><small>Gửi lời mời đến email đã đăng ký của thành viên.</small></div>
              <label>
                Email tài khoản
                <input required type="email" maxLength={256} value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <p>Dùng email đã đăng ký Give-AID. Tài khoản được liên kết với hồ sơ này khi người nhận chấp nhận lời mời.</p>
              <button type="submit" disabled={busy}>Gửi lời mời</button>
            </form>
          )}
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>Đóng</button>
          {!profile.userId && !inviting && (
            <button type="button" onClick={() => setInviting(true)}>Mời liên kết tài khoản</button>
          )}
          {profile.userId && !profile.roles.includes("OWNER") && (
            <button type="button" className="secondary" disabled={busy || (!profile.isActive && !profile.accountActive)} onClick={() => void perform(onChangeState)}>
              {profile.isActive ? "Thu hồi quyền" : "Khôi phục quyền"}
            </button>
          )}
        </div>
      </dialog>
    </LocalizedTree>
  );
}

export default function WorkspaceMembers({
  id, canManage = false, inviteRoles = [], onChange, heading: Heading = "h2", organizationName, ownerStats,
}: {
  id: string;
  canManage?: boolean;
  inviteRoles?: string[];
  onChange?: () => Promise<void>;
  heading?: "h1" | "h2";
  organizationName?: string;
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
        <header className={styles.header}>
          <div>
            {ownerStats && <span className={styles.ownerEyebrow}>KHÔNG GIAN TỔ CHỨC · {organizationName}</span>}
            <Heading>Nhân sự</Heading>
            <p>{canManage ? "Quản lý hồ sơ, vai trò và quyền truy cập của thành viên trong tổ chức." : "Danh sách thành viên và vai trò trong tổ chức."}</p>
          </div>
          {canManage && (
            <button type="button" disabled={busy} onClick={() => { startAction(); setEditor({ kind: "create" }); }}>
              <span aria-hidden="true">＋</span> Thêm nhân sự
            </button>
          )}
        </header>

        {ownerStats && (
          <section className={styles.ownerMemberStats} aria-label="Tổng quan nhân sự">
            <article><span>Thành viên đang hoạt động</span><strong>{ownerStats.activeMembers}</strong><small>Đang đồng hành cùng tổ chức</small></article>
            <article><span>Đội ngũ nhân sự</span><strong>{ownerStats.staffCount}</strong><small>Không bao gồm chủ tổ chức</small></article>
            <article><span>Lời mời đang chờ</span><strong>{ownerStats.pendingInvitations}</strong><small>Có thể theo dõi trong tab Lời mời</small></article>
          </section>
        )}

        {message && <p className="notice success" role="status">{message}</p>}
        {error && <p className="notice error" role="alert">{error}</p>}

        <div className={styles.surface}>
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
            !members ? <p className={styles.empty} role="status">Đang tải nhân sự…</p> : (
              <>
                {members.items.length === 0 ? (
                  <div className={styles.empty}><strong>Không tìm thấy thành viên</strong><p>Thử từ khóa khác hoặc điều chỉnh bộ lọc.</p></div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr>
                        <th scope="col">Thành viên</th>
                        {canManage && <th scope="col">Điện thoại</th>}
                        <th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Ngày thêm</th>
                        {canManage && <th scope="col">Thao tác</th>}
                      </tr></thead>
                      <tbody>
                        {members.items.map((member) => (
                          <tr key={member.id}>
                            <td>
                              <div className={styles.person}>
                                <Avatar name={member.fullName} photo={member.photo} />
                                <div><strong>{member.fullName}</strong>{member.email && <small>{member.email}</small>}</div>
                              </div>
                            </td>
                            {canManage && <td className={styles.nowrap}>{member.phone || "—"}</td>}
                            <td><Roles roles={member.roles} /></td>
                            <td>
                              <span className={styles.status} data-state={!member.userId ? "pending" : member.isActive && member.accountActive ? "active" : "inactive"}>
                                {accessStatus(member)}
                              </span>
                            </td>
                            <td className={styles.nowrap}>{date(member.joinedAt)}</td>
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
