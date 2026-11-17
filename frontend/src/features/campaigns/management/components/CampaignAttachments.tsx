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
  | "mediaPreviews"
  | "publishedEditable"
  | "setMessage"
  | "setSelected"
> & { selected: NonNullable<CampaignManagementModel["selected"]> };

export default function CampaignAttachments({
  action,
  busy,
  mediaPreviews,
  publishedEditable,
  selected,
  setMessage,
  setSelected,
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
        {publishedEditable && (
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
              PNG hoặc JPG, tối đa 5 MB
              <input name="file" type="file" accept=".png,.jpg,.jpeg" required />
            </label>
            <button disabled={busy}>Tải tệp lên</button>
          </form>
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
