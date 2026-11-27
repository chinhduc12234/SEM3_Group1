import styles from "@/features/campaigns/Campaigns.module.css";
import CampaignLocalizedTree from "@/features/campaigns/components/CampaignLocalizedTree";
import CampaignRouteMap, { type RouteStop } from "./CampaignRouteMap";
import { formatCampaignDate as date } from "../../formatCampaignDate";
import type { SubmissionSchedule } from "@/features/campaigns/types/submission";

export default function CampaignItinerary({
  schedules,
  stops,
  province,
}: {
  schedules: SubmissionSchedule[];
  stops: RouteStop[];
  province: string;
}) {
  return (
    <CampaignLocalizedTree>
      <>
        {" "}
        <section className={styles.detailSection}>
          <div className={styles.storyDivider} />
          <h2>Lịch trình và hoạt động</h2>
          {schedules.length === 0 ? (
            <p className={styles.sectionLead}>Chiến dịch chưa công khai lịch hoạt động chi tiết.</p>
          ) : (
            <div className={styles.scheduleList}>
              {schedules.map((schedule, dayIndex) => (
                <article className={styles.scheduleCard} key={`${schedule.date}-${dayIndex}`}>
                  <header>
                    <span className={styles.dayLabel}>Ngày {dayIndex + 1}</span>
                    <div>
                      <h3>{schedule.title || `Lịch biểu ${dayIndex + 1}`}</h3>
                      <p>
                        {[date(schedule.date), schedule.location || province].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </header>
                  {schedule.description && (
                    <p className={styles.scheduleDescription}>{schedule.description}</p>
                  )}
                  <div className={styles.activities}>
                    <h4>Hoạt động trong lịch biểu</h4>
                    {schedule.activities?.length ? (
                      schedule.activities.map((activity, activityIndex) => (
                        <div className={styles.activity} key={activityIndex}>
                          <div className={styles.activityTime}>
                            {activity.start || "—"} – {activity.end || "—"}
                          </div>
                          <div>
                            <h4>{activity.title || `Hoạt động ${activityIndex + 1}`}</h4>
                            {activity.detail && <p>{activity.detail}</p>}
                            {(activity.ward || province || activity.address) && <p className={styles.activityPlace}>
                              <strong>Địa điểm:</strong>{" "}
                              {[activity.ward, province, activity.address].filter(Boolean).join(" · ")}
                            </p>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>Chưa có hoạt động được nhập cho ngày này.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className={styles.detailSection}>
          <div className={styles.storyDivider} />
          <h2>Bản đồ lịch trình</h2>
          {stops.length ? (
            <div className={styles.routeMapWrap}>
              <CampaignRouteMap province={province} stops={stops} autoShow />
            </div>
          ) : (
            <p className={styles.state}>Chưa có xã/phường của hoạt động để đánh dấu trên bản đồ.</p>
          )}
        </section>
      </>
    </CampaignLocalizedTree>
  );
}
