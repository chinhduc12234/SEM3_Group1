import { StatusPill } from "@/shared/ui/StatusVisuals";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { applicationStatuses, type RegistrationDetail } from "./volunteerManagementTypes";
import styles from "./VolunteerManagementPanel.module.css";

export default function VolunteerApplicantProfile({ detail, dateFormat }: {
  detail: RegistrationDetail;
  dateFormat: Intl.DateTimeFormat;
}) {
  const dateOfBirth = detail.dateOfBirth && dateFormat.format(new Date(`${detail.dateOfBirth}T00:00:00Z`));
  const emergencyContact = [detail.emergencyContactName, detail.emergencyContactPhone].filter(Boolean).join(" · ");
  const fields = [
    ["Email", detail.email],
    ["Điện thoại", detail.phoneNumber],
    ["Ngày sinh", dateOfBirth || "—"],
    ["Nghề nghiệp", detail.occupation || "—"],
    ["Kỹ năng", detail.skills || "—"],
    ["Sức khỏe", detail.healthNote || "—"],
    ["Kinh nghiệm", detail.experience || "—"],
    ["Động lực", detail.motivation || "—"],
    ["Liên hệ khẩn cấp", emergencyContact || "—"],
  ];
  const tone = detail.status === "APPROVED" ? "positive"
    : detail.status === "REJECTED" ? "danger"
    : detail.status === "SUBMITTED" ? "info" : "warning";

  return <LocalizedTree>
    <header className={styles.detailHeading}>
      <span className={styles.avatar} aria-hidden="true">{detail.fullName.trim().charAt(0).toUpperCase()}</span>
      <div>
        <p className={styles.kicker}>HỒ SƠ TÌNH NGUYỆN</p>
        <h3>{detail.fullName}</h3>
      </div>
      <StatusPill tone={tone}>
        {applicationStatuses[detail.status as keyof typeof applicationStatuses] ?? detail.status}
      </StatusPill>
    </header>
    {detail.reviewNote && <p className={styles.reviewNote}>{detail.reviewNote}</p>}
    <dl>
      {fields.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  </LocalizedTree>;
}
