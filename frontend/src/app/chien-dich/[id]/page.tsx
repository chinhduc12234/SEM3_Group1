"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, downloadDocument } from "@/shared/api/api";
import { Campaign, causes } from "@/features/campaigns/types/campaigns";
import CampaignRouteMap, { RouteStop } from "@/features/campaigns/components/CampaignRouteMap";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";
import "../campaigns.css";

type Expense = { name?: string; amount?: number | string; description?: string };
type ScheduleActivity = { start?: string; end?: string; detail?: string; ward?: string; address?: string };
type Schedule = { title?: string; description?: string; date?: string; activities?: ScheduleActivity[] };
type SubmissionDetails = {
  expenses?: Expense[];
  methods?: string[];
  bank?: { name?: string; otherName?: string; accountHolder?: string; accountNumber?: string };
  goods?: { description?: string; target?: string; address?: string };
  transparencyCommitment?: string;
  volunteers?: { count?: string; health?: string; skills?: string; description?: string; templateName?: string };
  schedules?: Schedule[];
  province?: string;
  evidenceFiles?: string[];
  galleryFiles?: string[];
};

const date = (value?: string) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const amount = (value?: string | number) => Number(value || 0).toLocaleString("vi-VN");
function parseDetails(value?: string): SubmissionDetails {
  try { return JSON.parse(value || "{}") as SubmissionDetails; }
  catch { return {}; }
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Campaign>(`/api/campaigns/${id}`).then(value => { if (active) setCampaign(value); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);

  const details = useMemo(() => parseDetails(campaign?.additionalDetails), [campaign?.additionalDetails]);
  const schedules = useMemo(() => [...(details.schedules || [])].sort((a, b) => (a.date || "").localeCompare(b.date || "")), [details.schedules]);
  const stops = useMemo<RouteStop[]>(() => schedules.flatMap((schedule, dayIndex) => [...(schedule.activities || [])]
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""))
    .map((activity, activityIndex) => ({ date: schedule.date || "", start: activity.start || "", ward: activity.ward || "", detail: activity.detail || "", day: dayIndex + 1, activity: activityIndex + 1 }))
    .filter(stop => !!stop.ward)), [schedules]);

  const cover = campaign?.media.find(media => media.kind === "COVER");
  const gallery = campaign?.media.filter(media => media.kind === "GALLERY") || [];
  const documents = campaign?.media.filter(media => media.kind === "DOCUMENT") || [];
  const evidence = gallery.filter(media => details.evidenceFiles?.includes(media.fileName));
  const storyGallery = details.galleryFiles?.length ? gallery.filter(media => details.galleryFiles?.includes(media.fileName)) : gallery.filter(media => !evidence.includes(media));
  const fundingMethods = details.methods || [];

  return <LocalizedTree><main className="cp-page cp-detail"><div className="cp-container">
    <Link className="cp-back" href="/chien-dich">← Tất cả chiến dịch</Link>
    {error ? <p className="cp-state" role="alert">{error}</p> : !campaign ? <p className="cp-state" role="status">Đang tải thông tin chiến dịch…</p> : <>
      <header className="cp-detail-heading"><div><p className="cp-eyebrow"><span/> {causes[campaign.cause] || campaign.cause} / CHIẾN DỊCH CỘNG ĐỒNG</p><h1>{campaign.title}</h1><p className="cp-detail-deck">{campaign.description}</p><div className="cp-detail-meta"><span>✳ &nbsp; GIVE-AID</span><span>{campaign.location}</span><span>Đã được tổ chức phê duyệt</span></div></div><div className="cp-heading-mark" aria-hidden="true">✳</div></header>
      {cover ? <figure className="cp-detail-cover"><img src={`/api/campaigns/${id}/media/${cover.id}`} alt={`Ảnh đại diện chiến dịch ${campaign.title}`}/><figcaption>CHIẾN DỊCH CỘNG ĐỒNG <span>GIVE-AID</span></figcaption></figure> : <div className="cp-detail-no-cover" aria-hidden="true">✳</div>}
      <div className="cp-story-layout"><article className="cp-story">
        <section className="cp-detail-section"><div className="cp-story-kicker">01 / THÔNG TIN CHIẾN DỊCH</div><h2>Hành trình<br/><em>bắt đầu từ sự sẻ chia.</em></h2><div className="cp-story-body">{campaign.description.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><dl className="cp-public-grid"><div><dt>Đối tượng thụ hưởng</dt><dd>{campaign.beneficiaryDescription || causes[campaign.cause] || "—"}</dd></div><div><dt>Thời gian chiến dịch</dt><dd>{date(campaign.startDate)} – {date(campaign.endDate)}</dd></div><div><dt>Tỉnh/thành phố</dt><dd>{details.province || campaign.location}</dd></div><div><dt>Email liên hệ</dt><dd>{campaign.contactEmail || "Không cung cấp"}</dd></div><div><dt>Điện thoại liên hệ</dt><dd>{campaign.contactPhone}</dd></div></dl></section>

        <section className="cp-detail-section"><div className="cp-story-divider"/><div className="cp-story-kicker">02 / MỤC TIÊU VÀ NGUỒN LỰC</div><h2>Cùng nhau<br/><em>góp sức đúng nơi.</em></h2><p className="cp-section-lead">Mục tiêu quyên góp: <strong>{amount(campaign.goalAmount)} VNĐ</strong></p>{details.expenses?.length ? <div className="cp-expense-list">{details.expenses.map((expense, index) => <article className="cp-public-card" key={`${expense.name}-${index}`}><h3>Khoản chi {index + 1}: {expense.name || "—"}</h3><p><strong>Số tiền dự kiến:</strong> {amount(expense.amount)} VNĐ</p><p><strong>Mục đích sử dụng:</strong> {expense.description || "—"}</p></article>)}</div> : null}
          <div className="cp-public-card"><h3>Phương thức nhận tài trợ</h3><p>{fundingMethods.join(" · ") || "Chưa có thông tin"}</p>
            {fundingMethods.includes("Chuyển khoản ngân hàng") && <dl className="cp-public-grid cp-public-grid-compact"><div><dt>Ngân hàng</dt><dd>{details.bank?.name === "Ngân hàng khác" ? details.bank.otherName : details.bank?.name || "—"}</dd></div><div><dt>Chủ tài khoản</dt><dd>{details.bank?.accountHolder || "—"}</dd></div><div><dt>Số tài khoản</dt><dd>{details.bank?.accountNumber || "—"}</dd></div></dl>}
            {fundingMethods.includes("Mã QR ngân hàng") && <div className="cp-public-qr"><strong>Mã QR ngân hàng</strong><img src="/campaign-bank-qr.jpg" alt="Mã QR nhận quyên góp"/><small>Quét mã QR để xem thông tin chuyển khoản.</small></div>}
            {fundingMethods.includes("Nhận hiện vật") && <dl className="cp-public-grid cp-public-grid-compact"><div><dt>Hiện vật cần quyên góp</dt><dd>{details.goods?.description || "—"}</dd></div><div><dt>Số lượng mục tiêu</dt><dd>{details.goods?.target || "Không đặt số lượng"}</dd></div><div><dt>Địa chỉ tiếp nhận</dt><dd>{details.goods?.address || "—"}</dd></div></dl>}
          </div>
          {details.transparencyCommitment && <div className="cp-public-card"><h3>Cam kết minh bạch thu chi</h3><p className="cp-preserve-lines">{details.transparencyCommitment}</p></div>}
        </section>

        <section className="cp-detail-section"><div className="cp-story-divider"/><div className="cp-story-kicker">03 / TÌNH NGUYỆN VIÊN</div><h2>Chung tay<br/><em>trong từng công việc.</em></h2><div className="cp-public-card"><p><strong>Số lượng cần tuyển:</strong> {details.volunteers?.count || campaign.volunteerTarget} người</p>{details.volunteers?.health && <p><strong>Yêu cầu sức khỏe:</strong> {details.volunteers.health}</p>}{details.volunteers?.skills && <p><strong>Kỹ năng cần có:</strong> {details.volunteers.skills}</p>}{details.volunteers?.description && <p><strong>Mô tả công việc:</strong> {details.volunteers.description}</p>}{documents.map(document => <p className="cp-download-row" key={document.id}><strong>Biểu mẫu tuyển tình nguyện:</strong> {document.fileName}<button type="button" onClick={() => void downloadDocument(`/api/campaigns/${id}/media/${document.id}`, document.fileName).catch(ex => setError(ex.message))}>Tải biểu mẫu</button></p>)}</div></section>

        <section className="cp-detail-section"><div className="cp-story-divider"/><div className="cp-story-kicker">04 / HÌNH ẢNH CHIẾN DỊCH</div><h2>Những khoảnh khắc<br/><em>được sẻ chia.</em></h2>{evidence.length > 0 && <><h3 className="cp-subheading">Ảnh bằng chứng</h3><div className="cp-gallery-grid">{evidence.map((media, index) => <figure key={media.id}><img src={`/api/campaigns/${id}/media/${media.id}`} alt={`Ảnh bằng chứng ${index + 1}`} loading="lazy"/><figcaption>{media.fileName}</figcaption></figure>)}</div></>}{storyGallery.length > 0 && <><h3 className="cp-subheading">Ảnh phụ trong bài viết</h3><div className="cp-gallery-grid">{storyGallery.map((media, index) => <figure key={media.id}><img src={`/api/campaigns/${id}/media/${media.id}`} alt={`Hình ảnh ${index + 1} của chiến dịch ${campaign.title}`} loading="lazy"/><figcaption>{media.fileName}</figcaption></figure>)}</div></>}</section>

        <section className="cp-detail-section"><div className="cp-story-divider"/><div className="cp-story-kicker">05–06 / LỊCH BIỂU VÀ HOẠT ĐỘNG</div><h2>Mỗi ngày<br/><em>một việc thiết thực.</em></h2>{schedules.length === 0 ? <p className="cp-section-lead">Chiến dịch chưa công khai lịch hoạt động chi tiết.</p> : <div className="cp-schedule-list">{schedules.map((schedule, dayIndex) => <article className="cp-schedule-card" key={`${schedule.date}-${dayIndex}`}><header><span className="cp-day-label">Ngày {dayIndex + 1}</span><div><h3>{schedule.title || `Lịch biểu ${dayIndex + 1}`}</h3><p>{date(schedule.date)} · {details.province || campaign.location}</p></div></header>{schedule.description && <p className="cp-schedule-description">{schedule.description}</p>}<div className="cp-activities"><h4>Hoạt động trong lịch biểu</h4>{schedule.activities?.length ? schedule.activities.map((activity, activityIndex) => <div className="cp-activity" key={activityIndex}><div className="cp-activity-time">{activity.start || "—"} – {activity.end || "—"}</div><div><h4>Hoạt động {activityIndex + 1}</h4><p>{activity.detail || "—"}</p><p className="cp-activity-place"><strong>Địa điểm:</strong> {[activity.ward, details.province || campaign.location].filter(Boolean).join(", ")}{activity.address ? ` · ${activity.address}` : ""}</p></div></div>) : <p>Chưa có hoạt động được nhập cho ngày này.</p>}</div></article>)}</div>}</section>

        <section className="cp-detail-section"><div className="cp-story-divider"/><div className="cp-story-kicker">07 / LỘ TRÌNH CHIẾN DỊCH</div><h2>Nhìn rõ<br/><em>hành trình sẻ chia.</em></h2><p className="cp-section-lead">Bản đồ hiển thị các xã/phường theo thứ tự ngày và giờ; chọn điểm để xem ngày, lịch biểu và hoạt động tương ứng.</p>{stops.length ? <div className="cp-route-map-wrap"><CampaignRouteMap province={details.province || campaign.location} stops={stops} autoShow/></div> : <p className="cp-state">Chưa có xã/phường của hoạt động để đánh dấu trên bản đồ.</p>}</section>
      </article>

      <aside className="cp-facts"><div className="cp-facts-inner"><p className="cp-eyebrow"><span/> THÔNG TIN CHIẾN DỊCH</p><h2>Cùng nhau<br/><em>chung tay.</em></h2><p className="cp-facts-intro">Thông tin do tổ chức cung cấp giúp bạn hiểu rõ mục tiêu và phạm vi của chiến dịch này.</p><dl><div><dt>Mục tiêu quyên góp</dt><dd>{campaign.goalAmount.toLocaleString("vi-VN")} <small>VNĐ</small></dd></div><div><dt>Số tình nguyện viên dự kiến</dt><dd>{campaign.volunteerTarget} <small>người</small></dd></div><div><dt>Thời gian</dt><dd>{date(campaign.startDate)} — {date(campaign.endDate)}</dd></div><div><dt>Địa điểm</dt><dd>{details.province || campaign.location}</dd></div><div><dt>Số lịch biểu</dt><dd>{schedules.length} <small>ngày</small></dd></div><div><dt>Số hoạt động có địa điểm</dt><dd>{stops.length}</dd></div></dl><div className="cp-contact"><span>LIÊN HỆ CHIẾN DỊCH</span><p>{campaign.contactEmail || "Không cung cấp email"}<br/>{campaign.contactPhone}</p></div><Link className="cp-back-list" href="/chien-dich">Khám phá chiến dịch khác <span>↗</span></Link></div></aside>
      </div>
    </>}</div></main></LocalizedTree>;
}
