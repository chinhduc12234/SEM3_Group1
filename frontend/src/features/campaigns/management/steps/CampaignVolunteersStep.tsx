import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";

type Props = Pick<
  CampaignManagementModel,
  | "endDate"
  | "selected"
  | "setStep"
  | "setVolunteerFile"
  | "setVolunteerFileError"
  | "startDate"
  | "step"
  | "submittedDetails"
  | "volunteerFile"
  | "volunteerFileError"
>;

export default function CampaignVolunteersStep({
  endDate,
  selected,
  setStep,
  setVolunteerFile,
  setVolunteerFileError,
  startDate,
  step,
  submittedDetails,
  volunteerFile,
  volunteerFileError,
}: Props) {
  return (
    <LocalizedTree>
      <div hidden={step !== 3} data-campaign-step-three>
        <h3>Thông tin tuyển tình nguyện viên</h3>
        <p className="muted">Nhập thông tin tuyển tình nguyện viên và có thể đính kèm biểu mẫu.</p>
        <div>
          <label>
            <span>
              Số lượng tình nguyện viên cần tuyển{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <input
              name="volunteerCount"
              defaultValue={
                submittedDetails?.volunteers?.count || String(selected?.volunteerTarget || "")
              }
              type="number"
              min="1"
              max="1000000"
              step="1"
              required={step === 3}
            />
          </label>
          <label>
            <span>
              Yêu cầu về sức khỏe{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              name="volunteerHealth"
              defaultValue={submittedDetails?.volunteers?.health || ""}
              maxLength={4000}
              required={step === 3}
            />
            <small>Chỉ mô tả khả năng cần thiết để thực hiện công việc.</small>
          </label>
          <label>
            <span>
              Kỹ năng cần có{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              name="volunteerSkills"
              defaultValue={submittedDetails?.volunteers?.skills || ""}
              maxLength={4000}
              required={step === 3}
            />
          </label>
          <label>
            Mô tả công việc tình nguyện
            <textarea
              name="volunteerDescription"
              defaultValue={submittedDetails?.volunteers?.description || ""}
              maxLength={4000}
            />
          </label>
        </div>
        <div>
          {selected?.media.find((media) => media.kind === "DOCUMENT") && (
            <p className="muted">
              Biểu mẫu hiện tại:{" "}
              {selected.media.find((media) => media.kind === "DOCUMENT")?.fileName}. Chọn tệp mới
              nếu muốn thay.
            </p>
          )}
          <label className={`${managementStyles.documentPicker} ${managementStyles.volunteerFile}`}>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                const validType =
                  (/\.pdf$/i.test(file.name) && (!file.type || file.type === "application/pdf")) ||
                  (/\.docx$/i.test(file.name) &&
                    (!file.type ||
                      file.type ===
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
                if (!validType || file.size > 10 * 1024 * 1024 || file.size === 0) {
                  setVolunteerFile(null);
                  setVolunteerFileError(
                    "Vui lòng chọn file PDF hoặc DOCX không rỗng, tối đa 10 MB.",
                  );
                  return;
                }
                setVolunteerFileError("");
                setVolunteerFile(file);
              }}
            />
            <span className={managementStyles.documentIcon} aria-hidden="true">
              ⇧
            </span>
            <strong>
              {selected?.media.some((media) => media.kind === "DOCUMENT")
                ? "Thay biểu mẫu tuyển dụng (không bắt buộc)"
                : "Chọn biểu mẫu tuyển dụng (không bắt buộc)"}
            </strong>
            <small>PDF hoặc DOCX, tối đa 10 MB</small>
          </label>
          {volunteerFileError && (
            <p className="notice error" role="alert">
              {volunteerFileError}{" "}
              <button type="button" className="quiet" onClick={() => setVolunteerFileError("")}>
                Không đính kèm
              </button>
            </p>
          )}
          {volunteerFile && (
            <p>
              {volunteerFile.name}{" "}
              <button
                type="button"
                className="quiet"
                onClick={() => {
                  setVolunteerFile(null);
                  setVolunteerFileError("");
                }}
              >
                Bỏ file
              </button>
            </p>
          )}
          <small>Biểu mẫu được giữ tạm trong form, chưa được lưu lên hệ thống.</small>
        </div>
        <div className="form-grid">
          <label>
            Ngày bắt đầu
            <input type="date" value={startDate} readOnly />
          </label>
          <label>
            Ngày kết thúc
            <input type="date" value={endDate} readOnly />
          </label>
        </div>
        <small>Thời gian diễn ra chiến dịch được lấy từ bước 1.</small>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setStep(2)}>
            ← Quay lại
          </button>
          <button
            type="button"
            onClick={(e) => {
              if (volunteerFileError) return;
              const form = e.currentTarget.form;
              if (!form) return;
              for (const control of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
                "[data-campaign-step-three] input, [data-campaign-step-three] textarea",
              )) {
                if (control.closest("[hidden]") || control.disabled) continue;
                if (!control.reportValidity()) return;
              }
              setStep(4);
            }}
          >
            Tiếp theo →
          </button>
        </div>
      </div>
    </LocalizedTree>
  );
}
