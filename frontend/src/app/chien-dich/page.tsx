"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/shared/api/api";
import { CampaignListItem, causes } from "@/features/campaigns/types/campaigns";
import { PageResult } from "@/features/organizations/types/workspace";
import { LocalizedTree } from "@/shared/i18n/LocaleProvider";
import "./campaigns.css";

export default function CampaignsPage() {
  const [data, setData] = useState<PageResult<CampaignListItem> | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ search: "", cause: "" });
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    const timer = setTimeout(() => {
    api<PageResult<CampaignListItem>>(`/api/campaigns?page=${page}&search=${encodeURIComponent(filter.search)}&cause=${encodeURIComponent(filter.cause)}`)
      .then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e.message); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [page, filter]);
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    setPage(1);
    setFilter({ search: String(values.get("search") || "").trim(), cause: String(values.get("cause") || "") });
  }
  return <LocalizedTree><main className="cp-page">
    <header className="cp-intro"><div className="cp-container cp-intro-grid"><div><p className="cp-eyebrow"><span/> NHỮNG ĐIỀU TỐT ĐẸP ĐANG DIỄN RA</p><h1>Mỗi chiến dịch,<br/><em>một cơ hội sẻ chia.</em></h1></div><div className="cp-intro-copy"><span className="cp-intro-mark">✳</span><p>Phía sau mỗi chiến dịch là một câu chuyện, một cộng đồng và những người đang cùng nhau hành động. Hãy dành một chút thời gian tìm hiểu hành trình mà bạn muốn đồng hành.</p><a href="#kham-pha">Khám phá các chiến dịch <span aria-hidden="true">↓</span></a></div></div><div className="cp-intro-bottom cp-container"><span>GIVE-AID / CỘNG ĐỒNG</span><span>CÙNG NHAU TẠO NÊN THAY ĐỔI</span></div></header>
    <section className="cp-container cp-explore" id="kham-pha"><div className="cp-section-heading"><div><p className="cp-eyebrow"><span/> KHÁM PHÁ & ĐỒNG HÀNH</p><h2>Những câu chuyện<br/><em>cần bạn chung tay.</em></h2></div><p>Mỗi hành động đều bắt đầu từ sự quan tâm. Tìm một chiến dịch gần gũi với điều bạn tin tưởng và tìm hiểu thêm về những người được hỗ trợ.</p></div>
      <form className="cp-search" onSubmit={search}><label>Tìm kiếm chiến dịch<input name="search" value={filter.search} onChange={e=>{setPage(1);setData(null);setFilter(current=>({...current,search:e.target.value}));}} maxLength={200} placeholder="Tên chiến dịch bạn quan tâm…"/></label><label>Danh mục<select name="cause" value={filter.cause} onChange={e=>{setPage(1);setData(null);setFilter(current=>({...current,cause:e.target.value}));}}><option value="">Tất cả lĩnh vực</option>{Object.entries(causes).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><button type="submit">Tìm chiến dịch <span aria-hidden="true">↗</span></button></form>
      <div className="cp-results-heading"><div><span>CHIẾN DỊCH CỘNG ĐỒNG</span><h3>Những hành trình đang mở</h3></div>{data&&<p>{data.totalCount} chiến dịch</p>}</div>
      {error&&<p className="cp-state" role="alert">{error}</p>}{!data&&!error&&<p className="cp-state" role="status">Đang tải các chiến dịch…</p>}
      {data?.items.length===0&&<p className="cp-state">Chưa có chiến dịch phù hợp. Hãy thử một từ khóa hoặc danh mục khác.</p>}
      <div className="cp-grid">{data?.items.map((campaign,index)=><article className="cp-card" key={campaign.id}><Link className="cp-card-image" href={`/chien-dich/${campaign.id}`} aria-label={`Xem chiến dịch ${campaign.title}`}>{campaign.coverMediaId?<img src={`/api/campaigns/${campaign.id}/media/${campaign.coverMediaId}`} alt={`Ảnh đại diện chiến dịch ${campaign.title}`} loading={index===0?"eager":"lazy"}/>:<span className="cp-image-placeholder" aria-hidden="true">✳</span>}<span className="cp-card-category">{causes[campaign.cause]||campaign.cause}</span></Link><div className="cp-card-body"><div className="cp-card-meta"><span>{campaign.location}</span><span>CHIẾN DỊCH CỘNG ĐỒNG</span></div><h3><Link href={`/chien-dich/${campaign.id}`}>{campaign.title}</Link></h3><p className="cp-card-description">{campaign.description}</p><div className="cp-card-goals"><div><span>Mục tiêu quyên góp</span><strong>{campaign.goalAmount.toLocaleString("vi-VN")} <small>VNĐ</small></strong></div><div><span>Tình nguyện viên</span><strong>{campaign.volunteerTarget} <small>người</small></strong></div></div><Link className="cp-read-more" href={`/chien-dich/${campaign.id}`}>Tìm hiểu câu chuyện <span aria-hidden="true">↗</span></Link></div></article>)}</div>
      {data&&data.totalCount>0&&<div className="cp-pagination"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Trang trước</button><span>Trang {page}</span><button disabled={page*20>=data.totalCount} onClick={()=>setPage(p=>p+1)}>Trang sau →</button></div>}
    </section><aside className="cp-endnote"><div className="cp-container"><p className="cp-eyebrow"><span/> CÙNG NHAU SẺ CHIA</p><h2>Một sự quan tâm nhỏ<br/><em>có thể đi rất xa.</em></h2><p>Đằng sau mỗi con số là những con người và câu chuyện. Cùng tìm hiểu, kết nối và lan tỏa điều tốt đẹp theo cách của bạn.</p><Link href="/cach-tham-gia">Tìm hiểu cách tham gia <span aria-hidden="true">↗</span></Link></div></aside>
  </main></LocalizedTree>;
}
