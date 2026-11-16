import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";
import { downloadDocument } from "@/shared/api/api";
import { api } from "@/shared/api/api";
import type { Campaign } from "@/features/campaigns/types/campaigns";
import Link from "next/link";

type Props = Pick<
  CampaignManagementModel,
  | "action"
  | "busy"
  | "canReviewSelected"
  | "editable"
  | "manager"
  | "mediaPreviews"
  | "note"
  | "publishedEditable"
  | "setMessage"
  | "setNote"
  | "setSelected"
  | "viewing"
> & { selected: NonNullable<CampaignManagementModel["selected"]> };

export default function CampaignAttachments({
  action,
  busy,
  canReviewSelected,
  editable,
  manager,
  mediaPreviews,
  note,
  publishedEditable,
  selected,
  setMessage,
  setNote,
  setSelected,
  viewing,
}: Props) {
  return (
    <LocalizedTree>
      <>
        <h3>Ảnh và tài liệu</h3>
        <div className={managementStyles.reviewImages}>
          {selected.media
            .filter((m) => m.kind !== "DOCUMENT" && m.contentType.startsWith("image/"))
            .map((m) => (
              <figure key={m.id}>
                <strong>{m.kind === "COVER" ? "Ảnh đại diện" : "Ảnh thư viện"}</strong>
                {mediaPreviews[m.id]?.url ? (
                  <img
                    src={mediaPreviews[m.id].url}
                    alt={`${m.kind === "COVER" ? "Ảnh đại diện" : "Ảnh chiến dịch"}: ${m.fileName}`}
                  />
                ) : (
                  <p className="muted" role={mediaPreviews[m.id]?.error ? "status" : undefined}>
                    {mediaPreviews[m.id]?.error || "Đang tải ảnh xem trước…"}
                  </p>
                )}
                <figcaption>{m.fileName}</figcaption>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await downloadDocument(
                        `/api/campaigns/${selected.id}/media/${m.id}`,
                        m.fileName,
                      );
                    })
                  }
                >
                  Tải ảnh
                </button>
              </figure>
            ))}
        </div>
        {selected.media
          .filter((m) => m.kind === "DOCUMENT" || !m.contentType.startsWith("image/"))
          .map((m) => (
            <p key={m.id}>
              {m.kind}: {m.fileName}{" "}
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await downloadDocument(
                      `/api/campaigns/${selected.id}/media/${m.id}`,
                      m.fileName,
                    );
                  })
                }
              >
                Tải xuống để xem
              </button>
            </p>
          ))}
        {(editable || publishedEditable) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              f.set("version", selected.version);
              if (!f.get("replaceId")) f.delete("replaceId");
              void action(async () => {
                setSelected(
                  await api<Campaign>(`/api/campaigns/${selected.id}/media`, {
                    method: "POST",
                    body: f,
                  }),
                );
                setMessage("Đã tải tệp lên.");
              });
            }}
          >
            <label>
              Loại tệp
              <select name="kind">
                <option value="COVER">Ảnh đại diện</option>
                <option value="GALLERY">Ảnh thư viện</option>
                {!publishedEditable && <option value="DOCUMENT">Tài liệu hỗ trợ</option>}
              </select>
            </label>
            <label>
              Thêm mới hoặc thay ảnh
              <select name="replaceId">
                <option value="">Thêm ảnh mới / thay ảnh đại diện hiện tại</option>
                {selected.media
                  .filter((m) => m.kind !== "DOCUMENT")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      Thay {m.kind}: {m.fileName}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted">
              Chọn đúng loại tệp tương ứng khi thay ảnh. Chọn Ảnh thư viện để thêm ảnh; tải Ảnh đại
              diện sẽ thay ảnh đại diện hiện tại.
            </p>
            <label>
              PNG, JPG hoặc PDF, tối đa 5 MB
              <input name="file" type="file" accept=".png,.jpg,.jpeg,.pdf" required />
            </label>
            <button disabled={busy}>Tải tệp lên</button>
          </form>
        )}
        {manager && selected && ["DRAFT", "NEEDS_REVISION"].includes(selected.status) && (
          <div className="actions">
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  setSelected(
                    await api<Campaign>(`/api/campaigns/${selected.id}/submit`, {
                      method: "POST",
                      body: JSON.stringify({ version: selected.version }),
                    }),
                  );
                  setMessage("Đã gửi Owner xét duyệt.");
                })
              }
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2 11 13" />
                  <path d="m22 2-7 20-4-9-9-4Z" />
                </svg>
                Gửi Owner duyệt
              </span>
            </button>
          </div>
        )}
        {canReviewSelected && !viewing && selected && (
          <section>
            <h3>Owner xét duyệt</h3>
            <label>
              Nhận xét / lý do
              <textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="actions">
              {[
                ["APPROVE", "Phê duyệt và công khai"],
                ["REQUEST_CHANGES", "Yêu cầu chỉnh sửa"],
                ["REJECT", "Từ chối"],
              ].map(([decision, label]) => (
                <button
                  key={decision}
                  disabled={busy || (decision !== "APPROVE" && !note.trim())}
                  onClick={() =>
                    void action(async () => {
                      setSelected(
                        await api<Campaign>(`/api/campaigns/${selected.id}/review`, {
                          method: "POST",
                          body: JSON.stringify({
                            version: selected.version,
                            decision,
                            note,
                          }),
                        }),
                      );
                      setMessage("Đã lưu kết quả xét duyệt.");
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}
        {selected.status === "PUBLISHED" && (
          <p>
            <Link href={`/chien-dich/${selected.id}`}>Xem trang công khai →</Link>
          </p>
        )}
        <h3>Lịch sử</h3>
        {selected.reviews.map((r, i) => (
          <p key={i}>
            {new Date(r.createdAt).toLocaleString("vi-VN")} · {r.action} {r.note}
          </p>
        ))}
      </>
    </LocalizedTree>
  );
}
