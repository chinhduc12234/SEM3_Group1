"use client";
import orgStyles from "@/features/organizations/Organizations.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/shared/api/api";

type Organization = {
  id: string;
  name: string;
  type: string;
  province: string;
  mission: string;
  status: "ACTIVE" | "PAST";
};
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
      .then((result) => {
        if (current) setDirectory(result);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, []);

  const active = directory?.items.filter((item) => item.status === "ACTIVE").length ?? 0;
  const past = directory?.items.filter((item) => item.status === "PAST").length ?? 0;

  return (
    <LocalizedTree>
      <section
        className={`ga-section ${orgStyles.featuredOrgs}`}
        aria-labelledby="featured-orgs-title"
      >
        <div className="ga-container">
          <div className={orgStyles.featuredOrgsHeading}>
            <div>
              <p className="ga-kicker">CỘNG ĐỒNG GIVE-AID</p>
              <h2 id="featured-orgs-title">
                Những tổ chức
                <br />
                <em>đang tạo nên thay đổi.</em>
              </h2>
            </div>
            <div className={orgStyles.featuredOrgsIntro}>
              <p>
                Gặp gỡ những tổ chức đã được xét duyệt và đang cùng cộng đồng lan tỏa các hoạt động
                ý nghĩa.
              </p>
              {directory && (
                <div className={orgStyles.featuredOrgsCount}>
                  <strong>{directory.totalCount}</strong>
                  <span>tổ chức được giới thiệu</span>
                </div>
              )}
            </div>
          </div>

          {directory?.items.length ? (
            <div
              className={`${orgStyles.featuredOrgsGrid}${directory.items.length === 1 ? ` ${orgStyles.hasSingle}` : ""}`}
            >
              {directory.items.map((organization, index) => (
                <article className={orgStyles.featuredOrgCard} key={organization.id}>
                  <div className={orgStyles.featuredOrgTop}>
                    <span className={orgStyles.featuredOrgIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`${orgStyles.featuredOrgStatus} ${organization.status === "ACTIVE" ? "is-active" : orgStyles.isPast}`}
                    >
                      <i /> {organization.status === "ACTIVE" ? "Đang hoạt động" : "Từng đồng hành"}
                    </span>
                  </div>
                  <div className={orgStyles.featuredOrgMark} aria-hidden="true">
                    {organization.name.trim().charAt(0).toLocaleUpperCase("vi-VN")}
                  </div>
                  <p className={orgStyles.featuredOrgType}>
                    {types[organization.type] || "Tổ chức cộng đồng"}
                  </p>
                  <h3>{organization.name}</h3>
                  <p className={orgStyles.featuredOrgLocation}>
                    <span aria-hidden="true">⌖</span> {organization.province}
                  </p>
                  <p className={orgStyles.featuredOrgMission}>
                    {organization.mission.length > 165
                      ? organization.mission.slice(0, 162).trimEnd() + "…"
                      : organization.mission}
                  </p>
                  <Link className={orgStyles.featuredOrgLink} href="/chien-dich">
                    Khám phá hoạt động <span aria-hidden="true">↗</span>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className={orgStyles.featuredOrgsEmpty}>
              <span className={orgStyles.featuredOrgEmptyMark} aria-hidden="true">
                ✳
              </span>
              <div>
                <h3>{failed ? "Danh sách đang được cập nhật" : "Hành trình sẽ bắt đầu từ đây"}</h3>
                <p>
                  {failed
                    ? "Vui lòng quay lại sau để gặp gỡ các tổ chức trong cộng đồng Give-AID."
                    : "Những tổ chức đầu tiên sẽ xuất hiện tại đây sau khi hoàn tất xét duyệt."}
                </p>
              </div>
            </div>
          )}

          {directory?.items.length ? (
            <div className={orgStyles.featuredOrgsLegend}>
              <span>
                <i className="is-active" /> {active} đang hoạt động
              </span>
              <span>
                <i className={orgStyles.isPast} /> {past} từng đồng hành
              </span>
              <p>Thông tin hiển thị dựa trên trạng thái hồ sơ được Give-AID xét duyệt.</p>
            </div>
          ) : null}
        </div>
      </section>
    </LocalizedTree>
  );
}
