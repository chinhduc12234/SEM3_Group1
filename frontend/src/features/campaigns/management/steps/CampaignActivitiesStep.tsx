import { activityConflict } from "../campaignManagement";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";

type Props = Pick<
  CampaignManagementModel,
  | "province"
  | "scheduleError"
  | "schedules"
  | "setScheduleError"
  | "setSchedules"
  | "setStep"
  | "setWardRetry"
  | "step"
  | "wardStatus"
  | "wards"
>;

export default function CampaignActivitiesStep({
  province,
  scheduleError,
  schedules,
  setScheduleError,
  setSchedules,
  setStep,
  setWardRetry,
  step,
  wardStatus,
  wards,
}: Props) {
  return (
    <LocalizedTree>
      <div hidden={step !== 6} data-campaign-step-six>
        <h3>Hoạt động trong từng lịch biểu</h3>
        <p className="muted">Chọn lịch biểu để xem và nhập các hoạt động trong ngày.</p>
        {wardStatus === "error" && (
          <p className="notice error" role="alert">
            Không thể tải xã/phường.{" "}
            <button type="button" className="secondary" onClick={() => setWardRetry((n) => n + 1)}>
              Thử lại
            </button>
          </p>
        )}
        {scheduleError && (
          <p className="notice error" role="alert">
            {scheduleError}
          </p>
        )}
        {schedules.map((item, index) => (
          <details className={managementStyles.activitySchedule} key={item.id}>
            <summary>
              <span className={managementStyles.dayBadge}>Ngày {index + 1}</span>
              <span className={managementStyles.dayHeading}>
                <strong>{item.title || `Lịch biểu ${index + 1}`}</strong>
                <small>
                  {item.date} · {province} · {item.activities.length} hoạt động
                </small>
              </span>
            </summary>
            <div className={managementStyles.dayInfo}>
              <strong>Thông tin lịch biểu</strong>
              <p>{item.description}</p>
              <small>
                Ngày diễn ra: {item.date} · Địa điểm: {province}
              </small>
            </div>
            <div className={managementStyles.scheduleActivities}>
              <h4>Hoạt động trong ngày</h4>
              {item.activities.map((activity, activityIndex) => (
                <div className={managementStyles.scheduleActivity} key={activity.id}>
                  <div className={managementStyles.expenseHeading}>
                    <strong>Hoạt động {activityIndex + 1}</strong>
                    {item.activities.length > 1 && (
                      <button
                        type="button"
                        className={`quiet ${managementStyles.expenseRemove}`}
                        aria-label={`Xóa hoạt động ${activityIndex + 1}`}
                        onClick={() =>
                          setSchedules((items) =>
                            items.map((x) =>
                              x.id === item.id
                                ? {
                                    ...x,
                                    activities: x.activities.filter((a) => a.id !== activity.id),
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="form-grid">
                    <label>
                      <span>
                        Giờ bắt đầu{" "}
                        <span className={managementStyles.required} aria-hidden="true">
                          *
                        </span>
                      </span>
                      <input
                        type="time"
                        required={step === 6}
                        value={activity.start}
                        onChange={(e) => {
                          const start = e.target.value;
                          setSchedules((items) =>
                            items.map((x) =>
                              x.id === item.id
                                ? {
                                    ...x,
                                    activities: x.activities.map((a) =>
                                      a.id === activity.id ? { ...a, start } : a,
                                    ),
                                  }
                                : x,
                            ),
                          );
                        }}
                      />
                    </label>
                    <label>
                      <span>
                        Giờ kết thúc{" "}
                        <span className={managementStyles.required} aria-hidden="true">
                          *
                        </span>
                      </span>
                      <input
                        type="time"
                        required={step === 6}
                        value={activity.end}
                        aria-invalid={
                          !!(
                            activity.start &&
                            activity.end &&
                            (activity.end <= activity.start ||
                              activityConflict(item.activities, activity))
                          )
                        }
                        ref={(node) => {
                          if (node)
                            node.setCustomValidity(
                              activity.start && activity.end && activity.end <= activity.start
                                ? "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày."
                                : activityConflict(item.activities, activity)
                                  ? "Thời gian hoạt động bị trùng với hoạt động khác."
                                  : "",
                            );
                        }}
                        onChange={(e) => {
                          const end = e.target.value;
                          setSchedules((items) =>
                            items.map((x) =>
                              x.id === item.id
                                ? {
                                    ...x,
                                    activities: x.activities.map((a) =>
                                      a.id === activity.id ? { ...a, end } : a,
                                    ),
                                  }
                                : x,
                            ),
                          );
                        }}
                      />
                    </label>
                  </div>
                  {activity.start && activity.end && activity.end <= activity.start && (
                    <p className="notice error" role="alert">
                      Giờ kết thúc phải sau giờ bắt đầu và nằm trong cùng ngày.
                    </p>
                  )}
                  {activityConflict(item.activities, activity) && (
                    <p className="notice error" role="alert">
                      Thời gian hoạt động bị trùng với hoạt động khác trong lịch biểu. Vui lòng chọn
                      khoảng giờ khác.
                    </p>
                  )}
                  <label>
                    <span>
                      Nội dung hoạt động{" "}
                      <span className={managementStyles.required} aria-hidden="true">
                        *
                      </span>
                    </span>
                    <textarea
                      required={step === 6}
                      maxLength={4000}
                      value={activity.detail}
                      onChange={(e) => {
                        const detail = e.target.value;
                        setSchedules((items) =>
                          items.map((x) =>
                            x.id === item.id
                              ? {
                                  ...x,
                                  activities: x.activities.map((a) =>
                                    a.id === activity.id ? { ...a, detail } : a,
                                  ),
                                }
                              : x,
                          ),
                        );
                      }}
                    />
                  </label>
                  <div className="form-grid">
                    {(["Xã", "Phường"] as const).map((type) => (
                      <label key={type}>
                        <span>{type} thực hiện</span>
                        <select
                          required={step === 6 && !activity.ward}
                          value={
                            wards.some(
                              (w) =>
                                w.ten === activity.ward &&
                                (type === "Phường" ? w.loai === "Phường" : w.loai !== "Phường"),
                            )
                              ? activity.ward
                              : ""
                          }
                          disabled={wardStatus !== "ready"}
                          onChange={(e) => {
                            const ward = e.target.value;
                            setSchedules((items) =>
                              items.map((x) =>
                                x.id === item.id
                                  ? {
                                      ...x,
                                      activities: x.activities.map((a) =>
                                        a.id === activity.id ? { ...a, ward } : a,
                                      ),
                                    }
                                  : x,
                              ),
                            );
                          }}
                        >
                          <option value="">
                            {wardStatus === "loading"
                              ? "Đang tải…"
                              : wardStatus === "error"
                                ? "Không thể tải danh sách"
                                : `Chọn ${type.toLowerCase()}`}
                          </option>
                          {wards
                            .filter((w) =>
                              type === "Phường" ? w.loai === "Phường" : w.loai !== "Phường",
                            )
                            .map((w) => (
                              <option key={w.ma_xa} value={w.ten}>
                                {w.ten}
                              </option>
                            ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <small>
                    Chọn một xã hoặc một phường; các đơn vị hành chính khác nằm trong danh sách xã.
                  </small>
                  <label>
                    Địa chỉ thực hiện cụ thể
                    <input
                      type="text"
                      maxLength={400}
                      placeholder="Số nhà, đường, thôn/tổ dân phố…"
                      value={activity.address}
                      onChange={(e) => {
                        const address = e.target.value;
                        setSchedules((items) =>
                          items.map((x) =>
                            x.id === item.id
                              ? {
                                  ...x,
                                  activities: x.activities.map((a) =>
                                    a.id === activity.id ? { ...a, address } : a,
                                  ),
                                }
                              : x,
                          ),
                        );
                      }}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className={`secondary ${managementStyles.expenseAdd}`}
                onClick={() =>
                  setSchedules((items) =>
                    items.map((x) =>
                      x.id === item.id
                        ? {
                            ...x,
                            activities: [
                              ...x.activities,
                              {
                                id: x.activities.reduce((max, a) => Math.max(max, a.id), 0) + 1,
                                start: "",
                                end: "",
                                detail: "",
                                ward: "",
                                address: "",
                              },
                            ],
                          }
                        : x,
                    ),
                  )
                }
              >
                + Thêm hoạt động
              </button>
            </div>
          </details>
        ))}
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setStep(5)}>
            ← Quay lại
          </button>
          <button
            type="button"
            onClick={(e) => {
              if (wardStatus !== "ready") {
                setScheduleError("Vui lòng đợi danh sách xã/phường hoặc thử tải lại.");
                return;
              }
              const form = e.currentTarget.form;
              if (!form) return;
              for (const control of form.querySelectorAll<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >(
                "[data-campaign-step-six] input, [data-campaign-step-six] textarea, [data-campaign-step-six] select",
              )) {
                if (!control.checkValidity()) {
                  const details = control.closest("details");
                  if (details) details.open = true;
                  control.reportValidity();
                  return;
                }
              }
              setScheduleError("");
              setStep(7);
            }}
          >
            Tiếp theo →
          </button>
        </div>
      </div>
    </LocalizedTree>
  );
}
