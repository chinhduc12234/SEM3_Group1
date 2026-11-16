import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";

type Props = Pick<
  CampaignManagementModel,
  | "cover"
  | "evidence"
  | "gallery"
  | "imageChecking"
  | "imageError"
  | "imagePreviews"
  | "mediaPreviews"
  | "selected"
  | "setCover"
  | "setEvidence"
  | "setGallery"
  | "setImageChecking"
  | "setImageError"
  | "setStep"
  | "step"
>;

export default function CampaignImagesStep({
  cover,
  evidence,
  gallery,
  imageChecking,
  imageError,
  imagePreviews,
  mediaPreviews,
  selected,
  setCover,
  setEvidence,
  setGallery,
  setImageChecking,
  setImageError,
  setStep,
  step,
}: Props) {
  return (
    <LocalizedTree>
      <div hidden={step !== 4}>
        <h3>Hình ảnh chiến dịch</h3>
        <p className="muted">Thêm ảnh đại diện, ảnh bằng chứng và ảnh phụ cho bài viết.</p>
        {selected && (
          <section className={managementStyles.reviewBlock}>
            <h4>Ảnh đã tải lên</h4>
            <div className={managementStyles.reviewImages}>
              {selected.media
                .filter(
                  (media) => media.kind !== "DOCUMENT" && media.contentType.startsWith("image/"),
                )
                .map((media) => (
                  <figure key={media.id}>
                    {mediaPreviews[media.id]?.url ? (
                      <img src={mediaPreviews[media.id].url} alt={media.fileName} />
                    ) : (
                      <p className="muted">
                        {mediaPreviews[media.id]?.error || "Đang tải ảnh xem trước…"}
                      </p>
                    )}
                    <figcaption>
                      {media.kind}: {media.fileName}
                    </figcaption>
                  </figure>
                ))}
            </div>
            <p className="muted">Ảnh hiện tại được giữ nguyên. Có thể tải thêm ảnh bên dưới.</p>
          </section>
        )}
        {(
          [
            ["Ảnh thumbnail", cover ? [cover] : [], "cover"],
            ["Ảnh bằng chứng", evidence, "evidence"],
            ["Ảnh phụ trong bài viết", gallery, "gallery"],
          ] as const
        ).map(([label, files, kind]) => (
          <section className={managementStyles.campaignImages} key={kind}>
            <h4>{label}</h4>
            <label
              className={`${managementStyles.documentPicker} ${managementStyles.volunteerFile}`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple={kind !== "cover"}
                disabled={imageChecking}
                onChange={async (e) => {
                  const picked = Array.from(e.currentTarget.files || []);
                  e.currentTarget.value = "";
                  if (!picked.length) return;
                  if (
                    picked.some(
                      (f) =>
                        !["image/jpeg", "image/png"].includes(f.type) ||
                        f.size === 0 ||
                        f.size > 5 * 1024 * 1024,
                    )
                  ) {
                    setImageError("Chỉ nhận ảnh JPG hoặc PNG, tối đa 5 MB mỗi ảnh.");
                    return;
                  }
                  const existing =
                    kind === "cover"
                      ? [...evidence, ...gallery]
                      : [...(cover ? [cover] : []), ...evidence, ...gallery];
                  const stored =
                    selected?.media.filter(
                      (media) =>
                        media.kind !== "DOCUMENT" &&
                        !(cover && media.kind === "COVER") &&
                        !(kind === "cover" && media.kind === "COVER"),
                    ) || [];
                  const storedNames = new Set(
                    stored.map((media) => media.fileName.trim().toLocaleLowerCase()),
                  );
                  const names = new Set(existing.map((f) => f.name.trim().toLocaleLowerCase()));
                  if (
                    picked.some((f) => {
                      const n = f.name.trim().toLocaleLowerCase();
                      if (names.has(n) || storedNames.has(n)) return true;
                      names.add(n);
                      return false;
                    })
                  ) {
                    setImageError("Tên ảnh đã có trong danh sách. Vui lòng chọn ảnh khác.");
                    return;
                  }
                  if (existing.length + stored.length + picked.length > 12) {
                    setImageError("Chọn tối đa 12 ảnh chiến dịch.");
                    return;
                  }
                  setImageChecking(true);
                  try {
                    const all = [...existing, ...picked];
                    const contents = await Promise.all(
                      all.map(async (file) => new Uint8Array(await file.arrayBuffer())),
                    );
                    for (let i = existing.length; i < all.length; i++) {
                      for (let j = 0; j < i; j++) {
                        if (
                          contents[i].length === contents[j].length &&
                          contents[i].every((byte, index) => byte === contents[j][index])
                        ) {
                          setImageError(
                            "Ảnh này đã có trong danh sách, kể cả khi tên tệp khác. Vui lòng chọn ảnh khác.",
                          );
                          return;
                        }
                      }
                    }
                  } catch {
                    setImageError("Không thể đọc ảnh. Vui lòng chọn lại.");
                    return;
                  } finally {
                    setImageChecking(false);
                  }
                  setImageError("");
                  if (kind === "cover") setCover(picked[0]);
                  else if (kind === "evidence") setEvidence((items) => [...items, ...picked]);
                  else setGallery((items) => [...items, ...picked]);
                }}
              />
              <span className={managementStyles.documentIcon} aria-hidden="true">
                ⇧
              </span>
              <strong>
                {kind === "cover"
                  ? cover
                    ? "Thay ảnh thumbnail"
                    : "Chọn ảnh thumbnail"
                  : "Chọn một hoặc nhiều ảnh"}
              </strong>
              <small>
                {kind === "cover"
                  ? "Chỉ chọn 1 ảnh; chọn lại sẽ thay ảnh hiện tại."
                  : "Có thể chọn nhiều ảnh cùng lúc hoặc thêm ảnh sau."}{" "}
                JPG hoặc PNG, tối đa 5 MB mỗi ảnh.
              </small>
            </label>
            <div className={managementStyles.imagePreviews}>
              {files.map((file, index) => (
                <figure key={`${file.name}-${index}`}>
                  <img
                    src={imagePreviews.find((p) => p.file === file)?.url}
                    alt={`Xem trước ${file.name}`}
                  />
                  <figcaption>{file.name}</figcaption>
                  <button
                    type="button"
                    className="secondary"
                    disabled={imageChecking}
                    onClick={() => {
                      if (kind === "cover") setCover(null);
                      else if (kind === "evidence")
                        setEvidence((items) => items.filter((_, i) => i !== index));
                      else setGallery((items) => items.filter((_, i) => i !== index));
                      setImageError("");
                    }}
                  >
                    Xóa ảnh
                  </button>
                </figure>
              ))}
            </div>
          </section>
        ))}
        {imageError && (
          <p className="notice error" role="alert">
            {imageError}
          </p>
        )}
        <p className="muted">
          Tối đa 12 ảnh cho cả ba mục. Ảnh mới sẽ được tải lên khi bấm lưu ở bước 8.
        </p>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setStep(3)}>
            ← Quay lại
          </button>
          <button type="button" disabled={imageChecking} onClick={() => setStep(5)}>
            Tiếp theo →
          </button>
        </div>
      </div>
    </LocalizedTree>
  );
}
