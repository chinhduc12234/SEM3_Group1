import { useEffect, useRef, useState } from "react";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { Avatar, Roles } from "./MemberIdentity";
import type { Detail } from "./memberProfiles";
import styles from "./WorkspaceMembers.module.css";

export default function PersonnelDetail({
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
