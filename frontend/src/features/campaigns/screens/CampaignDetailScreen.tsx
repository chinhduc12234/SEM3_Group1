"use client";
import campaignStyles from "@/features/campaigns/Campaigns.module.css";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/api";
import { Campaign, causes } from "@/features/campaigns/types/campaigns";
import CampaignLocalizedTree from "@/features/campaigns/components/CampaignLocalizedTree";

type Expense = { name?: string; amount?: number | string; description?: string };
import {
  parseSubmissionDetails,
  sortSchedules,
  getCampaignRouteStops,
} from "@/features/campaigns/types/submission";
import { formatCampaignDate as date } from "../formatCampaignDate";
import CampaignSupport from "../components/CampaignSupport";
import CampaignItinerary from "../components/CampaignItinerary";
export default function CampaignDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Campaign>(`/api/campaigns/${id}`)
      .then((value) => {
        if (active) setCampaign(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const details = useMemo(
    () => parseSubmissionDetails(campaign?.additionalDetails) ?? {},
    [campaign?.additionalDetails],
  );
  const schedules = sortSchedules(details.schedules ?? []);
  const stops = getCampaignRouteStops(schedules);
  const cover = campaign?.media.find((media) => media.kind === "COVER");

  return (
    <CampaignLocalizedTree>
      <main className={`${campaignStyles.page} ${campaignStyles.detail}`}>
        <div className={campaignStyles.container}>
          <Link className={campaignStyles.back} href="/chien-dich">
            ← Tất cả chiến dịch
          </Link>
          {error ? (
            <p className={campaignStyles.state} role="alert">
              {error}
            </p>
          ) : !campaign ? (
            <p className={campaignStyles.state} role="status">
              Đang tải thông tin chiến dịch…
            </p>
          ) : (
            <>
              <header className={campaignStyles.detailHeading}>
                <div>
                  <p className={campaignStyles.eyebrow}>
                    <span /> {causes[campaign.cause] || campaign.cause} / CHIẾN DỊCH CỘNG ĐỒNG
                  </p>
                  <h1>{campaign.title}</h1>
                  <p className={campaignStyles.detailDeck}>{campaign.description}</p>
                  <div className={campaignStyles.detailMeta}>
                    <span>✳ &nbsp; GIVE-AID</span>
                    <span>{campaign.location}</span>
                    <span>Đã được tổ chức phê duyệt</span>
                  </div>
                </div>
                <div className={campaignStyles.headingMark} aria-hidden="true">
                  ✳
                </div>
              </header>
              {cover ? (
                <figure className={campaignStyles.detailCover}>
                  <img
                    src={`/api/campaigns/${id}/media/${cover.id}`}
                    alt={`Ảnh đại diện chiến dịch ${campaign.title}`}
                  />
                  <figcaption>
                    CHIẾN DỊCH CỘNG ĐỒNG <span>GIVE-AID</span>
                  </figcaption>
                </figure>
              ) : (
                <div className={campaignStyles.detailNoCover} aria-hidden="true">
                  ✳
                </div>
              )}
              <div className={campaignStyles.storyLayout}>
                <article className={campaignStyles.story} data-cp-story="">
                  <section className={campaignStyles.detailSection}>
                    <div className={campaignStyles.storyKicker}>01 / THÔNG TIN CHIẾN DỊCH</div>
                    <h2>
                      Hành trình
                      <br />
                      <em>bắt đầu từ sự sẻ chia.</em>
                    </h2>
                    <div className={campaignStyles.storyBody}>
                      {campaign.description
                        .split(/\n+/)
                        .filter(Boolean)
                        .map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                    <dl className={campaignStyles.publicGrid}>
                      <div>
                        <dt>Đối tượng thụ hưởng</dt>
                        <dd>{campaign.beneficiaryDescription || causes[campaign.cause] || "—"}</dd>
                      </div>
                      <div>
                        <dt>Thời gian chiến dịch</dt>
                        <dd>
                          {date(campaign.startDate)} – {date(campaign.endDate)}
                        </dd>
                      </div>
                      <div>
                        <dt>Tỉnh/thành phố</dt>
                        <dd>{details.province || campaign.location}</dd>
                      </div>
                      <div>
                        <dt>Email liên hệ</dt>
                        <dd>{campaign.contactEmail || "Không cung cấp"}</dd>
                      </div>
                      <div>
                        <dt>Điện thoại liên hệ</dt>
                        <dd>{campaign.contactPhone}</dd>
                      </div>
                    </dl>
                  </section>

                  <CampaignSupport
                    campaign={campaign}
                    details={details}
                    onDownloadError={setError}
                  />
                  <CampaignItinerary
                    schedules={schedules}
                    stops={stops}
                    province={details.province || campaign.location}
                  />
                </article>

                <aside className={campaignStyles.facts}>
                  <div className={campaignStyles.factsInner}>
                    <p className={campaignStyles.eyebrow}>
                      <span /> THÔNG TIN CHIẾN DỊCH
                    </p>
                    <h2>
                      Cùng nhau
                      <br />
                      <em>chung tay.</em>
                    </h2>
                    <p className={campaignStyles.factsIntro}>
                      Thông tin do tổ chức cung cấp giúp bạn hiểu rõ mục tiêu và phạm vi của chiến
                      dịch này.
                    </p>
                    <dl>
                      <div>
                        <dt>Mục tiêu quyên góp</dt>
                        <dd>
                          {campaign.goalAmount.toLocaleString("vi-VN")} <small>VNĐ</small>
                        </dd>
                      </div>
                      <div>
                        <dt>Số tình nguyện viên dự kiến</dt>
                        <dd>
                          {campaign.volunteerTarget} <small>người</small>
                        </dd>
                      </div>
                      <div>
                        <dt>Thời gian</dt>
                        <dd>
                          {date(campaign.startDate)} — {date(campaign.endDate)}
                        </dd>
                      </div>
                      <div>
                        <dt>Địa điểm</dt>
                        <dd>{details.province || campaign.location}</dd>
                      </div>
                      <div>
                        <dt>Số lịch biểu</dt>
                        <dd>
                          {schedules.length} <small>ngày</small>
                        </dd>
                      </div>
                      <div>
                        <dt>Số hoạt động có địa điểm</dt>
                        <dd>{stops.length}</dd>
                      </div>
                    </dl>
                    <div className={campaignStyles.contact}>
                      <span>LIÊN HỆ CHIẾN DỊCH</span>
                      <p>
                        {campaign.contactEmail || "Không cung cấp email"}
                        <br />
                        {campaign.contactPhone}
                      </p>
                    </div>
                    <Link className={campaignStyles.backList} href="/chien-dich">
                      Khám phá chiến dịch khác <span>↗</span>
                    </Link>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </CampaignLocalizedTree>
  );
}
