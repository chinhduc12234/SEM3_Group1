import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";
import { causes } from "@/features/campaigns/types/campaigns";
import CampaignRouteMap from "@/features/campaigns/components/CampaignRouteMap";

type Props = Pick<
  CampaignManagementModel,
  | "busy"
  | "cover"
  | "endDate"
  | "error"
  | "evidence"
  | "existingEvidenceFiles"
  | "existingGalleryFiles"
  | "expenses"
  | "gallery"
  | "id"
  | "imageChecking"
  | "imagePreviews"
  | "mediaPreviews"
  | "methods"
  | "province"
  | "review"
  | "routeStops"
  | "schedules"
  | "selected"
  | "setStep"
  | "startDate"
  | "step"
  | "submitCampaign"
  | "volunteerFile"
>;

export default function CampaignConfirmationStep({
  busy,
  cover,

  endDate,
  error,
  evidence,
  existingEvidenceFiles,
  existingGalleryFiles,
  expenses,
  gallery,
  id,
  imageChecking,
  imagePreviews,
  mediaPreviews,
  methods,

  province,
  review,
  routeStops,
  schedules,
  selected,
  setStep,

  startDate,
  step,
  submitCampaign,
  volunteerFile,
}: Props) {
  return (
    <LocalizedTree>
      <div hidden={step !== 8}>
        <h3>Kiểm tra thông tin chiến dịch</h3>
        <p className="muted">Kiểm tra thông tin từ bước 1 đến bước 7 trước khi gửi.</p>
        <section className={managementStyles.reviewBlock}>
          <h4>1. Thông tin chiến dịch</h4>
          <p>
            <strong>Tên chiến dịch:</strong> {review.title}
          </p>
          <p>
            <strong>Mô tả:</strong> {review.description}
          </p>
          <p>
            <strong>Đối tượng thụ hưởng:</strong> {causes[review.cause] || review.cause}
          </p>
          <p>
            <strong>Ngày bắt đầu:</strong> {startDate}
          </p>
          <p>
            <strong>Ngày kết thúc:</strong> {endDate}
          </p>
          <p>
            <strong>Địa điểm:</strong> {province}
          </p>
          <p>
            <strong>Email liên hệ:</strong> {review.contactEmail || "Không có"}
          </p>
          <p>
            <strong>Điện thoại liên hệ:</strong> {review.contactPhone}
          </p>
        </section>
        <section className={managementStyles.reviewBlock}>
          <h4>2. Mục tiêu chiến dịch</h4>
          {expenses.map((x, i) => (
            <p key={x.id}>
              <strong>Khoản chi {i + 1}:</strong> {x.name} ·{" "}
              {Number(x.amount).toLocaleString("vi-VN")} đ<br />
              <strong>Mục đích:</strong> {x.description}
            </p>
          ))}
          <p>
            <strong>Tổng mục tiêu quyên góp:</strong>{" "}
            {expenses.reduce((n, x) => n + (Number(x.amount) || 0), 0).toLocaleString("vi-VN")} đ
          </p>
          <p>
            <strong>Phương thức nhận tài trợ:</strong> {methods.join(", ") || "Chưa chọn"}
          </p>
          {methods.includes("Chuyển khoản ngân hàng") && (
            <>
              <p>
                <strong>Ngân hàng:</strong>{" "}
                {review.bankName === "Ngân hàng khác" ? review.otherBankName : review.bankName}
              </p>
              <p>
                <strong>Tên chủ tài khoản:</strong> {review.bankAccountHolder}
              </p>
              <p>
                <strong>Số tài khoản:</strong> {review.bankAccountNumber}
              </p>
            </>
          )}
          {methods.includes("Mã QR ngân hàng") && (
            <div>
              <strong>Mã QR ngân hàng:</strong>
              <div className={managementStyles.reviewImages}>
                <img src="/campaign-bank-qr.jpg" alt="Mã QR ngân hàng được cung cấp" />
              </div>
            </div>
          )}
          {methods.includes("Nhận hiện vật") && (
            <>
              <p>
                <strong>Loại hiện vật:</strong> {review.goodsDescription}
              </p>
              <p>
                <strong>Số lượng mục tiêu:</strong> {review.goodsTarget || "Không đặt số lượng"}
              </p>
              <p>
                <strong>Địa chỉ tiếp nhận:</strong> {review.goodsAddress}
              </p>
            </>
          )}
          <p>
            <strong>Cam kết công khai thu chi:</strong> {review.transparencyCommitment}
          </p>
        </section>
        <section className={managementStyles.reviewBlock}>
          <h4>3. Tình nguyện viên</h4>
          <p>
            <strong>Số lượng cần tuyển:</strong> {review.volunteerCount}
          </p>
          <p>
            <strong>Yêu cầu về sức khỏe:</strong> {review.volunteerHealth}
          </p>
          <p>
            <strong>Kỹ năng cần có:</strong> {review.volunteerSkills}
          </p>
          <p>
            <strong>Mô tả công việc:</strong> {review.volunteerDescription || "Không có"}
          </p>
          <p>
            <strong>Biểu mẫu:</strong>{" "}
            {volunteerFile?.name ||
              selected?.media.find((media) => media.kind === "DOCUMENT")?.fileName ||
              "Không có"}
          </p>
          <p>
            <strong>Ngày bắt đầu:</strong> {startDate}
          </p>
          <p>
            <strong>Ngày kết thúc:</strong> {endDate}
          </p>
        </section>
        <section className={managementStyles.reviewBlock}>
          <h4>4. Hình ảnh</h4>
          {(
            [
              ["Ảnh thumbnail", cover ? [cover] : [], "cover"],
              ["Ảnh bằng chứng", evidence, "evidence"],
              ["Ảnh phụ trong bài viết", gallery, "gallery"],
            ] as const
          ).map(([label, files, kind]) => {
            const stored =
              selected?.media.filter((media) =>
                kind === "cover"
                  ? !cover && media.kind === "COVER"
                  : kind === "evidence"
                    ? media.kind === "GALLERY" && existingEvidenceFiles.includes(media.fileName)
                    : media.kind === "GALLERY" && existingGalleryFiles.includes(media.fileName),
              ) || [];
            return (
              <div key={label}>
                <p>
                  <strong>{label}:</strong> {files.length + stored.length ? "" : "Chưa chọn"}
                </p>
                <div className={managementStyles.reviewImages}>
                  {stored.map((media) => (
                    <figure key={`stored-${media.id}`}>
                      {mediaPreviews[media.id]?.url ? (
                        <img
                          src={mediaPreviews[media.id].url}
                          alt={`Ảnh đã lưu: ${media.fileName}`}
                        />
                      ) : (
                        <p className="muted">
                          {mediaPreviews[media.id]?.error || "Đang tải ảnh xem trước…"}
                        </p>
                      )}
                      <figcaption>{media.fileName}</figcaption>
                    </figure>
                  ))}
                  {files.map((file, i) => (
                    <figure key={`${file.name}-${i}`}>
                      <img
                        src={imagePreviews.find((preview) => preview.file === file)?.url}
                        alt={`Xem trước ${file.name}`}
                      />
                      <figcaption>{file.name}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
        <section className={managementStyles.reviewBlock}>
          <h4>5. Lịch biểu</h4>
          {schedules.length === 0 ? (
            <p>Chưa có lịch biểu.</p>
          ) : (
            [...schedules]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((item, index) => (
                <div key={item.id}>
                  <p>
                    <strong>
                      Ngày {index + 1} · {item.title}
                    </strong>
                  </p>
                  <p>
                    <strong>Ngày diễn ra:</strong> {item.date}
                  </p>
                  <p>
                    <strong>Mô tả:</strong> {item.description}
                  </p>
                  <p>
                    <strong>Địa điểm:</strong> {province}
                  </p>
                </div>
              ))
          )}
        </section>
        <section className={managementStyles.reviewBlock}>
          <h4>6. Hoạt động</h4>
          {schedules.length === 0 ? (
            <p>Chưa có hoạt động.</p>
          ) : (
            [...schedules]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((item, index) => (
                <div key={item.id}>
                  <p>
                    <strong>
                      Ngày {index + 1} · {item.title} · {item.date}
                    </strong>
                  </p>
                  {[...item.activities]
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((activity, i) => (
                      <div key={activity.id}>
                        <p>
                          <strong>Hoạt động {i + 1}:</strong> {activity.start} – {activity.end}
                        </p>
                        <p>
                          <strong>Nội dung:</strong> {activity.detail}
                        </p>
                        <p>
                          <strong>Xã/Phường:</strong> {activity.ward}
                        </p>
                        <p>
                          <strong>Địa chỉ cụ thể:</strong> {activity.address || "Không có"}
                        </p>
                      </div>
                    ))}
                </div>
              ))
          )}
        </section>
        <section className={managementStyles.reviewBlock}>
          <h4>7. Địa điểm hoạt động và bản đồ xem trước</h4>
          {routeStops.length === 0 ? (
            <p>Chưa có địa điểm hoạt động.</p>
          ) : (
            <>
              <ol>
                {routeStops.map((stop, i) => (
                  <li key={i}>
                    <strong>
                      Ngày {stop.day} · Hoạt động {stop.activity}: {stop.ward}, {province}
                    </strong>{" "}
                    · {stop.date} · {stop.start}
                  </li>
                ))}
              </ol>
              <CampaignRouteMap province={province} stops={routeStops} autoShow={step === 8} />
            </>
          )}
        </section>
        <p className="notice">
          {selected?.status === "PENDING_REVIEW"
            ? "Khi lưu, các thông tin mới sẽ được cập nhật vào hồ sơ đang chờ Owner duyệt."
            : "Khi gửi, hệ thống sẽ lưu nội dung, lịch biểu, hoạt động, ảnh và tài liệu rồi chuyển chiến dịch sang trạng thái chờ Owner duyệt."}
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="secondary" disabled={busy} onClick={() => setStep(7)}>
            ← Quay lại
          </button>
          <button
            type="button"
            disabled={busy || imageChecking}
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (form) void submitCampaign(form);
            }}
          >
            {busy
              ? "Đang lưu…"
              : selected?.status === "PENDING_REVIEW"
                ? "Lưu thay đổi"
                : "Gửi Owner duyệt"}
          </button>
        </div>
      </div>
    </LocalizedTree>
  );
}
