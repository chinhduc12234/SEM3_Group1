"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import { Campaign, causes } from "@/features/campaigns/types/campaigns";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";
import "../campaigns.css";

const date = (value:string) => { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; };
export default function CampaignDetailPage() {
  const {id} = useParams<{id:string}>();
  const [campaign,setCampaign] = useState<Campaign|null>(null);
  const [error,setError] = useState("");
  useEffect(() => { let active=true; api<Campaign>(`/api/campaigns/${id}`).then(value=>{if(active)setCampaign(value);}).catch(e=>{if(active)setError(e.message);}); return()=>{active=false;}; },[id]);
  const cover=campaign?.media.find(m=>m.kind==="COVER");
  const gallery=campaign?.media.filter(m=>m.kind==="GALLERY")||[];
  return <LocalizedTree><main className="cp-page cp-detail"><div className="cp-container"><Link className="cp-back" href="/chien-dich">← Tất cả chiến dịch</Link>{error?<p className="cp-state" role="alert">{error}</p>:!campaign?<p className="cp-state" role="status">Đang tải câu chuyện…</p>:<><header className="cp-detail-heading"><div><p className="cp-eyebrow"><span/> {causes[campaign.cause]||campaign.cause} / CHIẾN DỊCH CỘNG ĐỒNG</p><h1>{campaign.title}</h1><p className="cp-detail-deck">{campaign.description}</p><div className="cp-detail-meta"><span>✳ &nbsp; GIVE-AID</span><span>{campaign.location}</span><span>Đã được tổ chức phê duyệt</span></div></div><div className="cp-heading-mark" aria-hidden="true">✳</div></header>
    {cover?<figure className="cp-detail-cover"><img src={`/api/campaigns/${id}/media/${cover.id}`} alt={`Ảnh đại diện chiến dịch ${campaign.title}`}/><figcaption>CHIẾN DỊCH CỘNG ĐỒNG <span>GIVE-AID</span></figcaption></figure>:<div className="cp-detail-no-cover" aria-hidden="true">✳</div>}
    <div className="cp-story-layout"><article className="cp-story"><div className="cp-story-kicker">01 / CÂU CHUYỆN CHIẾN DỊCH</div><h2>Hành trình<br/><em>bắt đầu từ sự sẻ chia.</em></h2><div className="cp-story-body">{campaign.description.split(/\n+/).filter(Boolean).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div><div className="cp-story-divider"/><div className="cp-story-kicker">02 / ĐỐI TƯỢNG THỤ HƯỞNG</div><h2>Vì những người<br/><em>cần được quan tâm.</em></h2><p className="cp-story-body">{campaign.beneficiaryDescription}</p>{gallery.length>0&&<section className="cp-gallery"><div className="cp-story-divider"/><div className="cp-story-kicker">03 / HÌNH ẢNH CHIẾN DỊCH</div><h2>Những khoảnh khắc<br/><em>được sẻ chia.</em></h2><div className="cp-gallery-grid">{gallery.map((m,i)=><figure key={m.id}><img src={`/api/campaigns/${id}/media/${m.id}`} alt={`Hình ảnh ${i+1} của chiến dịch ${campaign.title}`} loading="lazy"/></figure>)}</div></section>}</article>
      <aside className="cp-facts"><div className="cp-facts-inner"><p className="cp-eyebrow"><span/> THÔNG TIN CHIẾN DỊCH</p><h2>Cùng nhau<br/><em>chung tay.</em></h2><p className="cp-facts-intro">Thông tin do tổ chức cung cấp giúp bạn hiểu rõ mục tiêu và phạm vi của chiến dịch này.</p><dl><div><dt>Mục tiêu quyên góp</dt><dd>{campaign.goalAmount.toLocaleString("vi-VN")} <small>VNĐ</small></dd></div><div><dt>Số tình nguyện viên dự kiến</dt><dd>{campaign.volunteerTarget} <small>người</small></dd></div><div><dt>Thời gian</dt><dd>{date(campaign.startDate)} — {date(campaign.endDate)}</dd></div><div><dt>Địa điểm</dt><dd>{campaign.location}</dd></div></dl><div className="cp-contact"><span>LIÊN HỆ CHIẾN DỊCH</span><p>{campaign.contactEmail}<br/>{campaign.contactPhone}</p></div><Link className="cp-back-list" href="/chien-dich">Khám phá chiến dịch khác <span>↗</span></Link></div></aside></div></>}</div></main></LocalizedTree>;
}
