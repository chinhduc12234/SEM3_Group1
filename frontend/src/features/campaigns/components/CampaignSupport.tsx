import styles from "@/features/campaigns/Campaigns.module.css";
import CampaignLocalizedTree from "@/features/campaigns/components/CampaignLocalizedTree";
import type { Campaign } from "@/features/campaigns/types/campaigns";
import type { CampaignSubmissionDetails } from "@/features/campaigns/types/submission";
import { downloadDocument } from "@/shared/api/api";

export default function CampaignSupport({
  campaign,
  details,
  onDownloadError,
}: {
  campaign: Campaign;
  details: CampaignSubmissionDetails;
  onDownloadError: (message: string) => void;
}) {
  const { id } = campaign;
  const amount = (value?: string | number) => Number(value || 0).toLocaleString("vi-VN");
  const gallery = campaign.media.filter((media) => media.kind === "GALLERY");
  const documents = campaign.media.filter((media) => media.kind === "DOCUMENT");
  const evidence = gallery.filter((media) => details.evidenceFiles?.includes(media.fileName));
  const storyGallery = details.galleryFiles?.length
    ? gallery.filter((media) => details.galleryFiles?.includes(media.fileName))
    : gallery.filter((media) => !evidence.includes(media));
  const fundingMethods = details.methods || [];
  return (
    <CampaignLocalizedTree>
      <>
        {" "}
        <section className={styles.detailSection}>
          <div className={styles.storyDivider} />
          <div className={styles.storyKicker}>02 / MỤC TIÊU VÀ NGUỒN LỰC</div>
          <h2>
            Cùng nhau
            <br />
            <em>góp sức đúng nơi.</em>
          </h2>
          <p className={styles.sectionLead}>
            Mục tiêu quyên góp: <strong>{amount(campaign.goalAmount)} VNĐ</strong>
          </p>
          {details.expenses?.length ? (
            <div className={styles.expenseList}>
              {details.expenses.map((expense, index) => (
                <article className={styles.publicCard} key={`${expense.name}-${index}`}>
                  <h3>
                    Khoản chi {index + 1}: {expense.name || "—"}
                  </h3>
                  <p>
                    <strong>Số tiền dự kiến:</strong> {amount(expense.amount)} VNĐ
                  </p>
                  <p>
                    <strong>Mục đích sử dụng:</strong> {expense.description || "—"}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
          <div className={styles.publicCard}>
            <h3>Phương thức nhận tài trợ</h3>
            <p>{fundingMethods.join(" · ") || "Chưa có thông tin"}</p>
            {fundingMethods.includes("Chuyển khoản ngân hàng") && (
              <dl className={`${styles.publicGrid} ${styles.publicGridCompact}`}>
                <div>
                  <dt>Ngân hàng</dt>
                  <dd>
                    {details.bank?.name === "Ngân hàng khác"
                      ? details.bank.otherName
                      : details.bank?.name || "—"}
                  </dd>
                </div>
                <div>
                  <dt>Chủ tài khoản</dt>
                  <dd>{details.bank?.accountHolder || "—"}</dd>
                </div>
                <div>
                  <dt>Số tài khoản</dt>
                  <dd>{details.bank?.accountNumber || "—"}</dd>
                </div>
              </dl>
            )}
            {fundingMethods.includes("Mã QR ngân hàng") && (
              <div className={styles.publicQr}>
                <strong>Mã QR ngân hàng</strong>
                <img src="/campaign-bank-qr.jpg" alt="Mã QR nhận quyên góp" />
                <small>Quét mã QR để xem thông tin chuyển khoản.</small>
              </div>
            )}
            {fundingMethods.includes("Nhận hiện vật") && (
              <dl className={`${styles.publicGrid} ${styles.publicGridCompact}`}>
                <div>
                  <dt>Hiện vật cần quyên góp</dt>
                  <dd>{details.goods?.description || "—"}</dd>
                </div>
                <div>
                  <dt>Số lượng mục tiêu</dt>
                  <dd>{details.goods?.target || "Không đặt số lượng"}</dd>
                </div>
                <div>
                  <dt>Địa chỉ tiếp nhận</dt>
                  <dd>{details.goods?.address || "—"}</dd>
                </div>
              </dl>
            )}
          </div>
          {details.transparencyCommitment && (
            <div className={styles.publicCard}>
              <h3>Cam kết minh bạch thu chi</h3>
              <p className={styles.preserveLines}>{details.transparencyCommitment}</p>
            </div>
          )}
        </section>
        <section className={styles.detailSection}>
          <div className={styles.storyDivider} />
          <div className={styles.storyKicker}>03 / TÌNH NGUYỆN VIÊN</div>
          <h2>
            Chung tay
            <br />
            <em>trong từng công việc.</em>
          </h2>
          <div className={styles.publicCard}>
            <p>
              <strong>Số lượng cần tuyển:</strong>{" "}
              {details.volunteers?.count || campaign.volunteerTarget} người
            </p>
            {details.volunteers?.health && (
              <p>
                <strong>Yêu cầu sức khỏe:</strong> {details.volunteers.health}
              </p>
            )}
            {details.volunteers?.skills && (
              <p>
                <strong>Kỹ năng cần có:</strong> {details.volunteers.skills}
              </p>
            )}
            {details.volunteers?.description && (
              <p>
                <strong>Mô tả công việc:</strong> {details.volunteers.description}
              </p>
            )}
            {documents.map((document) => (
              <p className={styles.downloadRow} key={document.id}>
                <strong>Biểu mẫu tuyển tình nguyện:</strong> {document.fileName}
                <button
                  type="button"
                  onClick={() =>
                    void downloadDocument(
                      `/api/campaigns/${id}/media/${document.id}`,
                      document.fileName,
                    ).catch((ex) => onDownloadError(ex.message))
                  }
                >
                  Tải biểu mẫu
                </button>
              </p>
            ))}
          </div>
        </section>
        <section className={styles.detailSection}>
          <div className={styles.storyDivider} />
          <div className={styles.storyKicker}>04 / HÌNH ẢNH CHIẾN DỊCH</div>
          <h2>
            Những khoảnh khắc
            <br />
            <em>được sẻ chia.</em>
          </h2>
          {evidence.length > 0 && (
            <>
              <h3 className={styles.subheading}>Ảnh bằng chứng</h3>
              <div className={styles.galleryGrid}>
                {evidence.map((media, index) => (
                  <figure key={media.id}>
                    <img
                      src={`/api/campaigns/${id}/media/${media.id}`}
                      alt={`Ảnh bằng chứng ${index + 1}`}
                      loading="lazy"
                    />
                    <figcaption>{media.fileName}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
          {storyGallery.length > 0 && (
            <>
              <h3 className={styles.subheading}>Ảnh phụ trong bài viết</h3>
              <div className={styles.galleryGrid}>
                {storyGallery.map((media, index) => (
                  <figure key={media.id}>
                    <img
                      src={`/api/campaigns/${id}/media/${media.id}`}
                      alt={`Hình ảnh ${index + 1} của chiến dịch ${campaign.title}`}
                      loading="lazy"
                    />
                    <figcaption>{media.fileName}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
        </section>
      </>
    </CampaignLocalizedTree>
  );
}
