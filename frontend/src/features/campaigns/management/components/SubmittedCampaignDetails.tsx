import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import { campaignStatuses } from "@/features/campaigns/types/campaigns";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";
import { causes } from "@/features/campaigns/types/campaigns";
import { downloadDocument } from "@/shared/api/api";
import CampaignRouteMap from "@/features/campaigns/components/CampaignRouteMap";
import { CampaignConceptHistory } from "./CampaignConceptDetails";

type Props = Pick<
  CampaignManagementModel,
  | "action"
  | "busy"
  | "mediaPreviews"
  | "submittedDetails"
> & { selected: NonNullable<CampaignManagementModel["selected"]> };

export default function SubmittedCampaignDetails({
  action,

  busy,

  mediaPreviews,
  selected,

  submittedDetails,
}: Props) {
  return (
    <LocalizedTree>
      <section>
        <div className="actions">
          <span className={"badge " + selected.status}>
            {campaignStatuses[selected.status] || selected.status}
          </span>
        </div>
        <section className={managementStyles.reviewBlock}>
          <h4>Thông tin chiến dịch</h4>
          <p>
            <strong>Tên chiến dịch:</strong> {selected.title}
          </p>
          <p>
            <strong>Mô tả:</strong> {selected.description}
          </p>
          <p>
            <strong>Đối tượng thụ hưởng:</strong>{" "}
            {causes[selected.cause] || selected.beneficiaryDescription || selected.cause}
          </p>
          <p>
            <strong>Ngày bắt đầu:</strong> {selected.startDate}
          </p>
          <p>
            <strong>Ngày kết thúc:</strong> {selected.endDate}
          </p>
          <p>
            <strong>Địa điểm:</strong> {submittedDetails?.province || selected.location}
          </p>
          <p>
            <strong>Email liên hệ:</strong> {selected.contactEmail || "Không có"}
          </p>
          <p>
            <strong>Điện thoại liên hệ:</strong> {selected.contactPhone || "—"}
          </p>
        </section>
        <section className={managementStyles.reviewBlock}>
          <h4>Tình nguyện viên</h4>
          <p>
            <strong>Số lượng cần tuyển:</strong>{" "}
            {submittedDetails?.volunteers?.count || selected.volunteerTarget}
          </p>
          <p>
            <strong>Yêu cầu về sức khỏe:</strong> {submittedDetails?.volunteers?.health || "—"}
          </p>
          <p>
            <strong>Kỹ năng cần có:</strong> {submittedDetails?.volunteers?.skills || "—"}
          </p>
          <p>
            <strong>Mô tả công việc:</strong>{" "}
            {submittedDetails?.volunteers?.description || "Không có"}
          </p>
          <p>
            <strong>Biểu mẫu:</strong>{" "}
            {selected.media.find((media) => media.kind === "DOCUMENT")?.fileName ||
              submittedDetails?.volunteers?.templateName ||
              "Không có"}
          </p>
          {selected.media
            .filter((media) => media.kind === "DOCUMENT")
            .map((media) => (
              <button
                type="button"
                className="secondary"
                key={media.id}
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await downloadDocument(
                      `/api/campaigns/${selected.id}/media/${media.id}`,
                      media.fileName,
                    );
                  })
                }
              >
                Tải biểu mẫu {media.fileName}
              </button>
            ))}
        </section>
        {(() => {
          const images = selected.media.filter(
            (media) => media.kind !== "DOCUMENT" && media.contentType.startsWith("image/"),
          );
          const evidenceNames = new Set(submittedDetails?.evidenceFiles || []);
          const galleryNames = new Set(submittedDetails?.galleryFiles || []);
          const coverImages = images.filter((media) => media.kind === "COVER");
          const evidenceImages = images.filter(
            (media) => media.kind !== "COVER" && evidenceNames.has(media.fileName),
          );
          const galleryImages = images.filter(
            (media) =>
              media.kind !== "COVER" &&
              (galleryNames.has(media.fileName) || (!evidenceNames.size && !galleryNames.size)),
          );
          const renderImages = (items: typeof images, label: string) => (
            <div>
              <p>
                <strong>{label}:</strong> {items.length ? "" : "Chưa có ảnh"}
              </p>
              <div className={managementStyles.reviewImages}>
                {items.map((media) => (
                  <figure key={media.id}>
                    {mediaPreviews[media.id]?.url ? (
                      <img src={mediaPreviews[media.id].url} alt={`${label}: ${media.fileName}`} />
                    ) : (
                      <p className="muted">
                        {mediaPreviews[media.id]?.error || "Đang tải ảnh xem trước…"}
                      </p>
                    )}
                    <figcaption>{media.fileName}</figcaption>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await downloadDocument(
                            `/api/campaigns/${selected.id}/media/${media.id}`,
                            media.fileName,
                          );
                        })
                      }
                    >
                      Tải ảnh
                    </button>
                  </figure>
                ))}
              </div>
            </div>
          );
          return (
            <section className={managementStyles.reviewBlock}>
              <h4>Hình ảnh</h4>
              {renderImages(coverImages, "Ảnh thumbnail")}
              {renderImages(evidenceImages, "Ảnh bằng chứng")}
              {renderImages(galleryImages, "Ảnh phụ trong bài viết")}
            </section>
          );
        })()}
        <section className={managementStyles.reviewBlock}>
          <h4>Trạng thái gửi duyệt</h4>
          <p>
            <strong>Trạng thái:</strong> {campaignStatuses[selected.status] || selected.status}
          </p>
          <p>
            <strong>Ngày gửi Owner:</strong>{" "}
            {selected.reviews.find((review) => review.action === "SUBMIT")?.createdAt
              ? new Date(
                  selected.reviews.find((review) => review.action === "SUBMIT")!.createdAt,
                ).toLocaleString("vi-VN")
              : "—"}
          </p>
        </section>
        {selected.status !== "PUBLISHED" && <CampaignConceptHistory campaign={selected} />}
      </section>
    </LocalizedTree>
  );
}

export function SubmittedCampaignBudget({ selected, submittedDetails }: Pick<Props, "selected" | "submittedDetails">) {
  const hasBudget = selected.goalAmount > 0 || !!submittedDetails?.expenses?.length || !!submittedDetails?.methods?.length;
  if (!hasBudget) return <section className={managementStyles.reviewBlock}>
    <h3>Ngân sách</h3>
    <p className="muted">Chờ cập nhật</p>
  </section>;

  return (
    <section className={managementStyles.reviewBlock}>
      <h3>Ngân sách và mục tiêu quyên góp</h3>
      {submittedDetails?.expenses?.length ? (
        <>
          {submittedDetails.expenses.map((expense, index) => (
            <p key={expense.id ?? index}>
              <strong>Khoản chi {index + 1}:</strong> {expense.name} ·{" "}
              {Number(expense.amount || 0).toLocaleString("vi-VN")} đ<br />
              <strong>Mục đích:</strong> {expense.description}
            </p>
          ))}
          <p>
            <strong>Tổng mục tiêu quyên góp:</strong>{" "}
            {Number(selected.goalAmount).toLocaleString("vi-VN")} đ
          </p>
        </>
      ) : (
        <p>
          <strong>Mục tiêu quyên góp:</strong>{" "}
          {Number(selected.goalAmount).toLocaleString("vi-VN")} đ
        </p>
      )}
      <p>
        <strong>Phương thức nhận tài trợ:</strong>{" "}
        {submittedDetails?.methods?.join(", ") || "Chưa có thông tin"}
      </p>
      {submittedDetails?.methods?.includes("Chuyển khoản ngân hàng") && (
        <>
          <p>
            <strong>Ngân hàng:</strong>{" "}
            {submittedDetails.bank?.name === "Ngân hàng khác"
              ? submittedDetails.bank?.otherName
              : submittedDetails.bank?.name || "—"}
          </p>
          <p>
            <strong>Tên chủ tài khoản:</strong> {submittedDetails.bank?.accountHolder || "—"}
          </p>
          <p>
            <strong>Số tài khoản:</strong> {submittedDetails.bank?.accountNumber || "—"}
          </p>
        </>
      )}
      {submittedDetails?.methods?.includes("Mã QR ngân hàng") && (
        <div>
          <strong>Mã QR ngân hàng:</strong>
          <div className={managementStyles.reviewImages}>
            <img src="/campaign-bank-qr.jpg" alt="Mã QR ngân hàng" />
          </div>
        </div>
      )}
      {submittedDetails?.methods?.includes("Nhận hiện vật") && (
        <>
          <p>
            <strong>Loại hiện vật:</strong> {submittedDetails.goods?.description || "—"}
          </p>
          <p>
            <strong>Số lượng mục tiêu:</strong>{" "}
            {submittedDetails.goods?.target || "Không đặt số lượng"}
          </p>
          <p>
            <strong>Địa chỉ tiếp nhận:</strong> {submittedDetails.goods?.address || "—"}
          </p>
        </>
      )}
      <p>
        <strong>Cam kết công khai thu chi:</strong>{" "}
        {submittedDetails?.transparencyCommitment || "—"}
      </p>
    </section>
  );
}

export function SubmittedCampaignSchedule({ selected, submittedDetails, submittedSchedules, submittedStops }:
  Pick<Props, "selected" | "submittedDetails"> & Pick<CampaignManagementModel, "submittedSchedules" | "submittedStops">) {
  return <>
    <section className={managementStyles.reviewBlock}>
      <h3>Ngày triển khai</h3>
      {submittedSchedules.length === 0 ? (
        <p>Chưa có lịch biểu.</p>
      ) : (
        submittedSchedules.map((day, index) => (
          <div key={day.id}>
            <p>
              <strong>
                Ngày {index + 1} · {day.title}
              </strong>
            </p>
            <p>
              <strong>Ngày diễn ra:</strong> {day.date}
            </p>
            <p>
              <strong>Mô tả:</strong> {day.description}
            </p>
            <p>
              <strong>Địa điểm:</strong> {submittedDetails?.province || selected.location}
            </p>
          </div>
        ))
      )}
    </section>
    <section className={managementStyles.reviewBlock}>
      <h3>Hoạt động theo ngày</h3>
      {submittedSchedules.length === 0 ? (
        <p>Chưa có hoạt động.</p>
      ) : (
        submittedSchedules.map((day, index) => (
          <div key={day.id}>
            <p>
              <strong>
                Ngày {index + 1} · {day.title} · {day.date}
              </strong>
            </p>
            {day.activities.map((activity, activityIndex) => (
              <div key={activity.id}>
                <p>
                  <strong>Hoạt động {activityIndex + 1}:</strong> {activity.start} –{" "}
                  {activity.end}
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
      <h3>Địa điểm hoạt động và bản đồ</h3>
      {submittedStops.length === 0 ? (
        <p>Chưa có địa điểm hoạt động.</p>
      ) : (
        <>
          <ol>
            {submittedStops.map((stop, index) => (
              <li key={index}>
                <strong>
                  Ngày {stop.day} · Hoạt động {stop.activity}: {stop.ward},{" "}
                  {submittedDetails?.province || selected.location}
                </strong>{" "}
                · {stop.date} · {stop.start}
              </li>
            ))}
          </ol>
          <CampaignRouteMap
            province={submittedDetails?.province || selected.location}
            stops={submittedStops}
            autoShow
          />
        </>
      )}
    </section>
  </>;
}
