import { useId, type RefObject } from "react";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import styles from "./VolunteerManagementPanel.module.css";

export default function RemoveVolunteerDialog({ dialog, name, busy, error, onRemove }: {
  dialog: RefObject<HTMLDialogElement | null>; name: string; busy: boolean; error: string; onRemove: () => Promise<void>;
}) {
  const removalTitleId = useId();
  const removalDescriptionId = useId();
  return <LocalizedTree>
    <dialog ref={dialog} className={styles.removalDialog} aria-labelledby={removalTitleId} aria-describedby={removalDescriptionId}
      onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <h3 id={removalTitleId}>Xóa hồ sơ tình nguyện?</h3>
      <p id={removalDescriptionId}>
        <strong>{name}</strong><br />
        Hồ sơ sẽ được gỡ khỏi chiến dịch. Các suất đã xếp và nhiệm vụ đang giao sẽ bị hủy. Người này vẫn có thể đăng nhập và sử dụng tài khoản Give-AID bình thường.
      </p>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className={styles.reviewActions}>
        <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.close()}>Hủy</button>
        <button type="button" className="danger" disabled={busy} onClick={() => void onRemove()}>
          {busy ? "Đang xóa…" : "Xác nhận xóa"}
        </button>
      </div>
    </dialog>
  </LocalizedTree>;
}
