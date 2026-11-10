"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/shared/api/api";

type Organization = { id: string; name: string; type: string; province: string; mission: string; status: "ACTIVE" | "PAST" };
type Directory = { totalCount: number; items: Organization[] };

const types: Record<string, string> = {
  NGO: "Tổ chức phi chính phủ",
  CHARITY: "Tổ chức từ thiện",
  FOUNDATION: "Quỹ xã hội / từ thiện",
  ASSOCIATION: "Hiệp hội",
  SOCIAL_ENTERPRISE: "Doanh nghiệp xã hội",
};

export default function FeaturedOrganizations() {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    api<Directory>("/api/organizations/public")
      .then(result => { if (current) setDirectory(result); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, []);

  const active = directory?.items.filter(item => item.status === "ACTIVE").length ?? 0;
  const past = directory?.items.filter(item => item.status === "PAST").length ?? 0;

  return <section className="ga-section ga-featured-orgs" aria-labelledby="featured-orgs-title">
    <div className="ga-container">
      <div className="ga-featured-orgs-heading">
        <div><p className="ga-kicker">CỘNG ĐỒNG GIVE-AID</p><h2 id="featured-orgs-title">Những tổ chức<br/><em>đang tạo nên thay đổi.</em></h2></div>
        <div className="ga-featured-orgs-intro"><p>Gặp gỡ những tổ chức đã được xét duyệt và đang cùng cộng đồng lan tỏa các hoạt động ý nghĩa.</p>{directory && <div className="ga-featured-orgs-count"><strong>{directory.totalCount}</strong><span>tổ chức được giới thiệu</span></div>}</div>
      </div>

      {directory?.items.length ? <div className={`ga-featured-orgs-grid${directory.items.length === 1 ? " has-single" : ""}`}>{directory.items.map((organization, index) => <article className="ga-featured-org-card" key={organization.id}>
        <div className="ga-featured-org-top"><span className="ga-featured-org-index">{String(index + 1).padStart(2, "0")}</span><span className={`ga-featured-org-status ${organization.status === "ACTIVE" ? "is-active" : "is-past"}`}><i/> {organization.status === "ACTIVE" ? "Đang hoạt động" : "Từng đồng hành"}</span></div>
        <div className="ga-featured-org-mark" aria-hidden="true">{organization.name.trim().charAt(0).toLocaleUpperCase("vi-VN")}</div>
        <p className="ga-featured-org-type">{types[organization.type] || "Tổ chức cộng đồng"}</p>
        <h3>{organization.name}</h3>
        <p className="ga-featured-org-location"><span aria-hidden="true">⌖</span> {organization.province}</p>
        <p className="ga-featured-org-mission">{organization.mission.length > 165 ? organization.mission.slice(0, 162).trimEnd() + "…" : organization.mission}</p>
        <Link className="ga-featured-org-link" href="/chien-dich">Khám phá hoạt động <span aria-hidden="true">↗</span></Link>
      </article>)}</div> : <div className="ga-featured-orgs-empty"><span className="ga-featured-org-empty-mark" aria-hidden="true">✳</span><div><h3>{failed ? "Danh sách đang được cập nhật" : "Hành trình sẽ bắt đầu từ đây"}</h3><p>{failed ? "Vui lòng quay lại sau để gặp gỡ các tổ chức trong cộng đồng Give-AID." : "Những tổ chức đầu tiên sẽ xuất hiện tại đây sau khi hoàn tất xét duyệt."}</p></div></div>}

      {directory?.items.length ? <div className="ga-featured-orgs-legend"><span><i className="is-active"/> {active} đang hoạt động</span><span><i className="is-past"/> {past} từng đồng hành</span><p>Thông tin hiển thị dựa trên trạng thái hồ sơ được Give-AID xét duyệt.</p></div> : null}
    </div>
  </section>;
}
