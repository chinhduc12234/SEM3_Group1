import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";
import { causes } from "@/features/campaigns/types/campaigns";

type Props = Pick<
  CampaignManagementModel,
  | "endDate"
  | "province"
  | "provinceError"
  | "provinces"
  | "selected"
  | "setEndDate"
  | "setProvince"
  | "setSchedules"
  | "setStartDate"
  | "setStep"
  | "startDate"
  | "step"
>;

export default function CampaignBasicsStep({
  endDate,
  province,
  provinceError,
  provinces,
  selected,
  setEndDate,
  setProvince,
  setSchedules,
  setStartDate,
  setStep,
  startDate,
  step,
}: Props) {
  return (
    <LocalizedTree>
      <div hidden={step !== 1} data-campaign-step-one>
        <h3>Thông tin chiến dịch</h3>
        <p className="muted">Nhập thông tin cơ bản để bắt đầu chiến dịch.</p>
        <div className={managementStyles.createGrid}>
          <section className={`${managementStyles.createCard} ${managementStyles.createWide}`}>
            <h4>Thông tin cơ bản</h4>
            <div className={managementStyles.createCardBody}>
              <div className="form-grid">
                <label>
                  <span>
                    Tên chiến dịch{" "}
                    <span className={managementStyles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    name="title"
                    required
                    minLength={3}
                    maxLength={200}
                    defaultValue={selected?.title}
                  />
                </label>
                <label>
                  <span>
                    Đối tượng thụ hưởng{" "}
                    <span className={managementStyles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <select name="cause" required defaultValue={selected?.cause || ""}>
                    <option value="" disabled>
                      Chọn đối tượng thụ hưởng
                    </option>
                    {Object.entries(causes).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>
          <section className={managementStyles.createCard}>
            <h4>Mô tả chiến dịch</h4>
            <div className={managementStyles.createCardBody}>
              <label>
                <span>
                  Mô tả{" "}
                  <span className={managementStyles.required} aria-hidden="true">
                    *
                  </span>
                </span>
                <textarea
                  name="description"
                  required
                  minLength={30}
                  maxLength={10000}
                  defaultValue={selected?.description}
                />
                <small>Ít nhất 30 ký tự.</small>
              </label>
            </div>
          </section>
          <section className={managementStyles.createCard}>
            <h4>Thời gian chiến dịch</h4>
            <div className={managementStyles.createCardBody}>
              <div className="form-grid">
                <label>
                  <span>
                    Ngày bắt đầu{" "}
                    <span className={managementStyles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    name="startDate"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.currentTarget.value);
                      const end = e.currentTarget.form?.elements.namedItem(
                        "endDate",
                      ) as HTMLInputElement | null;
                      if (end) {
                        end.min = e.currentTarget.value;
                        end.setCustomValidity(
                          end.value && end.value < e.currentTarget.value
                            ? "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu."
                            : "",
                        );
                      }
                    }}
                  />
                </label>
                <label>
                  <span>
                    Ngày kết thúc{" "}
                    <span className={managementStyles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    name="endDate"
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.currentTarget.value);
                      e.currentTarget.setCustomValidity(
                        e.currentTarget.validity.rangeUnderflow
                          ? "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu."
                          : "",
                      );
                    }}
                  />
                </label>
              </div>
            </div>
          </section>
          <section className={managementStyles.createCard}>
            <h4>Địa điểm</h4>
            <div className={managementStyles.createCardBody}>
              <label>
                <span>
                  Địa điểm{" "}
                  <span className={managementStyles.required} aria-hidden="true">
                    *
                  </span>
                </span>
                <select
                  name="location"
                  required
                  value={province}
                  onChange={(e) => {
                    if (e.target.value !== province) {
                      setSchedules((items) =>
                        items.map((item) => ({
                          ...item,
                          activities: item.activities.map((activity) => ({
                            ...activity,
                            ward: "",
                          })),
                        })),
                      );
                    }
                    setProvince(e.target.value);
                  }}
                >
                  <option value="" disabled>
                    {provinceError ? "Không thể tải danh sách tỉnh/thành" : "Chọn tỉnh / thành phố"}
                  </option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {provinceError && (
                  <small>
                    Không thể tải danh sách tỉnh/thành. Vui lòng tải lại trang để thử lại.
                  </small>
                )}
              </label>
            </div>
          </section>
          <section className={managementStyles.createCard}>
            <h4>Thông tin liên hệ</h4>
            <div className={managementStyles.createCardBody}>
              <div className="form-grid">
                <label>
                  <span>
                    Email liên hệ <small>(không bắt buộc)</small>
                  </span>
                  <input
                    name="contactEmail"
                    type="email"
                    maxLength={256}
                    defaultValue={selected?.contactEmail}
                  />
                </label>
                <label>
                  <span>
                    Điện thoại liên hệ{" "}
                    <span className={managementStyles.required} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    name="contactPhone"
                    type="tel"
                    required
                    pattern="\+?[0-9 \(\)\-]{8,25}"
                    title="Nhập số điện thoại hợp lệ (8–25 ký tự)."
                    defaultValue={selected?.contactPhone}
                  />
                </label>
              </div>
            </div>
          </section>
        </div>
        <div className="actions">
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (!form) return;
              const controls = Array.from(
                form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
                  "[data-campaign-step-one] input, [data-campaign-step-one] textarea, [data-campaign-step-one] select",
                ),
              );
              for (const control of controls) {
                if (
                  (control.name === "title" || control.name === "description") &&
                  control.value.trim().length < (control.name === "title" ? 3 : 30)
                ) {
                  control.setCustomValidity(
                    control.name === "title"
                      ? "Tên chiến dịch cần ít nhất 3 ký tự."
                      : "Mô tả chiến dịch cần có ít nhất 30 ký tự.",
                  );
                } else if (control.name === "title" || control.name === "description") {
                  control.setCustomValidity("");
                }
                if (!control.reportValidity()) return;
              }
              setStep(2);
            }}
          >
            Tiếp theo →
          </button>
        </div>
      </div>
    </LocalizedTree>
  );
}
