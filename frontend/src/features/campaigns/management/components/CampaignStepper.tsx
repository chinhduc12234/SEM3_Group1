import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import styles from "../CampaignManagement.module.css";

const steps = [
  { label: "Thông tin", title: "Thông tin chiến dịch", description: "Thông tin cơ bản và liên hệ" },
  { label: "Mục tiêu", title: "Mục tiêu chiến dịch", description: "Quyên góp và tình nguyện" },
  { label: "Tình nguyện", title: "Tình nguyện viên", description: "Thông tin tuyển tình nguyện" },
  { label: "Hình ảnh", title: "Hình ảnh", description: "Ảnh chiến dịch" },
  { label: "Lịch biểu", title: "Lịch biểu", description: "Hoạt động chiến dịch" },
  { label: "Hoạt động", title: "Hoạt động", description: "Chi tiết từng lịch biểu" },
  { label: "Địa điểm", title: "Địa điểm", description: "Bản đồ hoạt động" },
  { label: "Tổng kết", title: "Xem lại", description: "Kiểm tra thông tin" },
];

type NavigationProps = { step: number; setStep: (step: number) => void };

export function CampaignStepIndicator({ step }: { step: number }) {
  return (
    <LocalizedTree>
      <ol className={styles.campaignSteps} aria-label="Các bước tạo chiến dịch">
        {steps.map(({ title, description }, index) => (
          <li key={title} aria-current={step === index + 1 ? "step" : undefined}>
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <small>{description}</small>
            </div>
          </li>
        ))}
      </ol>
    </LocalizedTree>
  );
}

export function CampaignViewNavigation({ step, setStep }: NavigationProps) {
  return (
    <LocalizedTree>
      <nav className={styles.campaignViewSteps} aria-label="Các bước thông tin chiến dịch">
        {steps.map(({ label }, index) => {
          const number = index + 1;
          const active = step === number;

          return (
            <button
              type="button"
              key={label}
              className={active ? styles.active : undefined}
              aria-current={active ? "step" : undefined}
              onClick={() => setStep(number)}
            >
              <strong>{number}</strong>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </LocalizedTree>
  );
}

export function CampaignViewControls({ step, setStep }: NavigationProps) {
  return (
    <LocalizedTree>
      <div className={styles.campaignViewControls}>
        <button
          type="button"
          className="secondary"
          disabled={step <= 1}
          onClick={() => setStep(step - 1)}
        >
          ← Bước trước
        </button>
        <span>
          Bước {step} / {steps.length}
        </span>
        <button type="button" disabled={step >= steps.length} onClick={() => setStep(step + 1)}>
          Bước sau →
        </button>
      </div>
    </LocalizedTree>
  );
}
