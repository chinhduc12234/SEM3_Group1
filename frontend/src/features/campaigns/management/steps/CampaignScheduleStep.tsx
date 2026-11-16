import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";

type Props = Pick<
  CampaignManagementModel,
  | "endDate"
  | "lastScheduleDate"
  | "province"
  | "scheduleError"
  | "scheduleLimit"
  | "schedules"
  | "setScheduleError"
  | "setSchedules"
  | "setStep"
  | "startDate"
  | "step"
>;

export default function CampaignScheduleStep({
  endDate,
  lastScheduleDate,
  province,
  scheduleError,
  scheduleLimit,
  schedules,
  setScheduleError,
  setSchedules,
  setStep,
  startDate,
  step,
}: Props) {
  return (
    <LocalizedTree>
      <div hidden={step !== 5} data-campaign-step-five>
        <h3>Lịch biểu chiến dịch</h3>
        <p className="muted">
          Tạo tối đa {scheduleLimit} lịch biểu, mỗi ngày một lịch. Ngày bắt đầu được tính; ngày kết
          thúc không tính.
        </p>
        {scheduleLimit === 0 && (
          <p className="notice">
            Khoảng thời gian chưa có ngày để tạo lịch biểu. Vui lòng chọn ngày kết thúc sau ngày bắt
            đầu ở bước 1.
          </p>
        )}
        {scheduleError && (
          <p className="notice error" role="alert">
            {scheduleError}
          </p>
        )}
        {schedules.length > scheduleLimit && (
          <p className="notice error" role="alert">
            Số lịch biểu vượt quá thời gian chiến dịch. Vui lòng xóa bớt lịch hoặc điều chỉnh thời
            gian ở bước 1.
          </p>
        )}
        {schedules.map((item, index) => (
          <section className={managementStyles.expense} key={item.id}>
            <div className={managementStyles.expenseHeading}>
              <strong>Lịch biểu {index + 1}</strong>
              <button
                type="button"
                className={`quiet ${managementStyles.expenseRemove}`}
                onClick={() => setSchedules((items) => items.filter((x) => x.id !== item.id))}
                aria-label={`Xóa lịch biểu ${index + 1}`}
              >
                ✕
              </button>
            </div>
            <label>
              <span>
                Tên lịch biểu{" "}
                <span className={managementStyles.required} aria-hidden="true">
                  *
                </span>
              </span>
              <input
                required={step === 5}
                maxLength={200}
                value={item.title}
                onChange={(e) =>
                  setSchedules((items) =>
                    items.map((x) => (x.id === item.id ? { ...x, title: e.target.value } : x)),
                  )
                }
              />
            </label>
            <label>
              <span>
                Mô tả lịch biểu{" "}
                <span className={managementStyles.required} aria-hidden="true">
                  *
                </span>
              </span>
              <textarea
                required={step === 5}
                maxLength={4000}
                value={item.description}
                onChange={(e) =>
                  setSchedules((items) =>
                    items.map((x) =>
                      x.id === item.id ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              <span>
                Ngày diễn ra{" "}
                <span className={managementStyles.required} aria-hidden="true">
                  *
                </span>
              </span>
              <input
                type="date"
                required={step === 5}
                min={startDate}
                max={lastScheduleDate}
                value={item.date}
                onChange={(e) => {
                  const date = e.target.value;
                  if (date && (date < startDate || date >= endDate)) {
                    setScheduleError(
                      "Ngày diễn ra phải nằm trong thời gian chiến dịch, trước ngày kết thúc.",
                    );
                    return;
                  }
                  if (date && schedules.some((x) => x.id !== item.id && x.date === date)) {
                    setScheduleError("Ngày này đã có lịch biểu. Mỗi ngày chỉ được tạo một lịch.");
                    return;
                  }
                  setScheduleError("");
                  setSchedules((items) =>
                    items.map((x) => (x.id === item.id ? { ...x, date } : x)),
                  );
                }}
              />
            </label>
            {item.date && (item.date < startDate || item.date >= endDate) && (
              <p className="notice error" role="alert">
                Ngày diễn ra phải nằm trong thời gian chiến dịch, trước ngày kết thúc.
              </p>
            )}
            {item.date && schedules.some((x) => x.id !== item.id && x.date === item.date) && (
              <p className="notice error" role="alert">
                Ngày này đã có lịch biểu. Mỗi ngày chỉ được tạo một lịch.
              </p>
            )}
            <label>
              Địa điểm lịch biểu
              <input value={province} readOnly />
            </label>
          </section>
        ))}
        <button
          type="button"
          className={`secondary ${managementStyles.expenseAdd}`}
          disabled={schedules.length >= scheduleLimit}
          onClick={() =>
            setSchedules((items) => [
              ...items,
              {
                id: items.reduce((max, x) => Math.max(max, x.id), 0) + 1,
                title: "",
                description: "",
                date: "",
                activities: [{ id: 1, start: "", end: "", detail: "", ward: "", address: "" }],
              },
            ])
          }
        >
          + Thêm lịch biểu
        </button>
        <p className="muted">
          Thông tin lịch biểu hiện được giữ tạm trong form, chưa lưu vào hệ thống.
        </p>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setStep(4)}>
            ← Quay lại
          </button>
          <button
            type="button"
            onClick={(e) => {
              if (
                schedules.length > scheduleLimit ||
                schedules.some((x) => !x.date || x.date < startDate || x.date >= endDate) ||
                new Set(schedules.map((x) => x.date)).size !== schedules.length
              ) {
                setScheduleError("Vui lòng kiểm tra số lượng và ngày diễn ra của các lịch biểu.");
                return;
              }
              const form = e.currentTarget.form;
              if (!form) return;
              for (const control of form.querySelectorAll<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >(
                "[data-campaign-step-five] input, [data-campaign-step-five] textarea, [data-campaign-step-five] select",
              )) {
                if (control.disabled) continue;
                if (!control.reportValidity()) return;
              }
              if (!schedules.length) {
                setScheduleError("Vui lòng thêm ít nhất một lịch biểu.");
                return;
              }
              setScheduleError("");
              setStep(6);
            }}
          >
            Tiếp theo →
          </button>
        </div>
      </div>
    </LocalizedTree>
  );
}
