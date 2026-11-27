import { useEffect, useRef, useState, type FormEvent } from "react";
import { memberRoles } from "@/features/organizations/types/workspace";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { Avatar } from "./MemberIdentity";
import type { Editor, Personnel } from "./memberProfiles";
import styles from "./WorkspaceMembers.module.css";

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

export default function PersonnelEditor({
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
