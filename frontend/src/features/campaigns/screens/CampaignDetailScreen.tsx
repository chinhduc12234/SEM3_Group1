"use client";
import campaignStyles from "@/features/campaigns/Campaigns.module.css";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/api";
import { Campaign, campaignTypes, causes } from "@/features/campaigns/types/campaigns";
import CampaignLocalizedTree from "@/features/campaigns/components/CampaignLocalizedTree";

type Expense = { name?: string; amount?: number | string; description?: string };
import {
  parseSubmissionDetails,
  sortSchedules,
  getCampaignRouteStops,
} from "@/features/campaigns/types/submission";
import { formatCampaignDate as date } from "../formatCampaignDate";
import CampaignSupport from "../components/CampaignSupport";
import CampaignItinerary from "../components/itinerary/CampaignItinerary";
import CampaignParticipationOptions from "../components/CampaignParticipationOptions";
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
  const publicPlan = campaign?.publicPlan;
  const schedules = publicPlan ? publicPlan.days.map((day, index) => ({
    id: index + 1, date: day.date ?? "", title: day.title, description: day.description, location: day.location,
    activities: day.activities.map((activity, activityIndex) => ({
      id: activityIndex + 1, title: activity.title, start: activity.start?.slice(0, 5) ?? "",
      end: activity.end?.slice(0, 5) ?? "", ward: "", address: activity.location, detail: "",
    })),
  })) : sortSchedules(details.schedules ?? []);
  const stops = publicPlan ? publicPlan.days.flatMap((day, index) => {
    if (!day.mapPin && !day.ward) return [];
    return [{ day: index + 1, activity: 0, title: day.title, date: date(day.date), start: "", detail: day.location,
      ward: day.ward ?? "", province: day.province ?? "", district: day.district ?? undefined, pin: day.mapPin,
      schedule: day.activities.map((activity) => [activity.start?.slice(0, 5), activity.title].filter(Boolean).join(" · ")) }];
  }) : getCampaignRouteStops(schedules);
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
                    <span /> {causes[campaign.cause] || campaign.cause} / {campaignTypes[campaign.campaignType]}
                  </p>
                  <h1>{campaign.title}</h1>
                  <p className={campaignStyles.detailDeck}>{publicPlan?.summary || campaign.description}</p>
                  <div className={campaignStyles.detailMeta}>
                    <span>✳ &nbsp; GIVE-AID</span>
                    <span>{campaign.location}</span>
                    <span>Đã được tổ chức phê duyệt</span>
                  </div>
                </div>
              </header>
              {cover && (
                <figure className={campaignStyles.detailCover}>
                  <img
                    src={`/api/campaigns/${id}/media/${cover.id}`}
                    alt={`Ảnh đại diện chiến dịch ${campaign.title}`}
                  />
                  <figcaption>
                    {campaignTypes[campaign.campaignType]} <span>GIVE-AID</span>
                  </figcaption>
                </figure>
              )}
              <div className={campaignStyles.storyLayout}>
                <article className={campaignStyles.story} data-cp-story="">
                  {campaign.status === "PUBLISHED" &&
                    <CampaignParticipationOptions key={campaign.id} campaign={campaign} />}
                  <section className={campaignStyles.detailSection}>
                    <h2>Thông tin chương trình</h2>
                    <div className={campaignStyles.storyBody}>
                      {campaign.description
                        .split(/\n+/)
                        .filter(Boolean)
                        .map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                    {publicPlan?.goal && <p><strong>Mục tiêu chương trình</strong> · {publicPlan.goal}</p>}
                    {publicPlan?.outcomes && <p><strong>Kết quả dự kiến</strong> · {publicPlan.outcomes}</p>}
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
                        <dt>Địa điểm</dt>
                        <dd>{details.province || campaign.location || (publicPlan?.eventFormat === "ONLINE" ? "Trực tuyến" : "—")}</dd>
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

                  {publicPlan ? <>
                    {publicPlan.fundraisingPurpose && <section className={campaignStyles.detailSection}>
                      <h2>Kế hoạch gây quỹ</h2>
                      <p>{publicPlan.fundraisingPurpose}</p>
                    </section>}
                    {campaign.media.some((media) => media.kind === "GALLERY") && <section className={campaignStyles.detailSection}>
                      <h2>Hình ảnh chương trình</h2>
                      <div className={campaignStyles.galleryGrid}>
                        {campaign.media.filter((media) => media.kind === "GALLERY").map((media, index) => <figure key={media.id}>
                          <img src={`/api/campaigns/${id}/media/${media.id}`} loading="lazy" alt={`Hình ảnh ${index + 1} của ${campaign.title}`} />
                        </figure>)}
                      </div>
                    </section>}
                  </> : <CampaignSupport
                    campaign={campaign}
                    details={details}
                    onDownloadError={setError}
                  />}
                  <CampaignItinerary
                    schedules={schedules}
                    stops={stops}
                    province={publicPlan ? "" : details.province || campaign.location}
                  />
                </article>

                <aside className={campaignStyles.facts}>
                  <div className={campaignStyles.factsInner}>
                    <h2>Thông tin chiến dịch</h2>
                    <dl>
                      <div>
                        <dt>Thời gian</dt>
                        <dd>{campaign.startDate === campaign.endDate ? date(campaign.startDate) : `${date(campaign.startDate)} – ${date(campaign.endDate)}`}</dd>
                      </div>
                      <div>
                        <dt>Địa điểm</dt>
                        <dd>{details.province || campaign.location || (publicPlan?.eventFormat === "ONLINE" ? "Trực tuyến" : "—")}</dd>
                      </div>
                      <div>
                        <dt>Mục tiêu quyên góp</dt>
                        <dd>
                          {campaign.goalAmount.toLocaleString("vi-VN")} <small>VNĐ</small>
                        </dd>
                      </div>
                      {!publicPlan && <div>
                        <dt>Số tình nguyện viên dự kiến</dt>
                        <dd>
                          {campaign.volunteerTarget} <small>người</small>
                        </dd>
                      </div>}
                      <div>
                        <dt>Số lịch biểu</dt>
                        <dd>
                          {schedules.length} <small>ngày</small>
                        </dd>
                      </div>
                      <div>
                        <dt>Số điểm trên lịch trình</dt>
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
