import styles from "@/features/campaigns/Campaigns.module.css";
import CampaignLocalizedTree from "@/features/campaigns/components/CampaignLocalizedTree";
import CampaignRouteMap, { type RouteStop } from "./CampaignRouteMap";
import { formatCampaignDate as date } from "../formatCampaignDate";
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
          <div className={styles.storyKicker}>05–06 / LỊCH BIỂU VÀ HOẠT ĐỘNG</div>
          <h2>
            Mỗi ngày
            <br />
            <em>một việc thiết thực.</em>
          </h2>
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
                        {date(schedule.date)} · {province}
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
                            <h4>Hoạt động {activityIndex + 1}</h4>
                            <p>{activity.detail || "—"}</p>
                            <p className={styles.activityPlace}>
                              <strong>Địa điểm:</strong>{" "}
                              {[activity.ward, province].filter(Boolean).join(", ")}
                              {activity.address ? ` · ${activity.address}` : ""}
                            </p>
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
          <div className={styles.storyKicker}>07 / LỘ TRÌNH CHIẾN DỊCH</div>
          <h2>
            Nhìn rõ
            <br />
            <em>hành trình sẻ chia.</em>
          </h2>
          <p className={styles.sectionLead}>
            Bản đồ hiển thị các xã/phường theo thứ tự ngày và giờ; chọn điểm để xem ngày, lịch biểu
            và hoạt động tương ứng.
          </p>
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
