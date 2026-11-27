"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import type { Campaign } from "@/features/campaigns/types/campaigns";
import { api, ApiError, type Account } from "@/shared/api/api";
import { Legend, StatusPill } from "@/shared/ui/StatusVisuals";
import { formatCampaignDate } from "../../formatCampaignDate";
import { VolunteerCapacity } from "./VolunteerCapacity";
import styles from "./VolunteerRegistrationWizard.module.css";

type OpeningGroup = {
  id: string; name: string; category: string; target: number; date: string | null;
  dayTitle: string | null; activityTitle: string | null; teamName: string | null; notes: string;
};
type Openings = { campaignId: string; days: { id: string; date: string | null; title: string }[]; groups: OpeningGroup[] };
type Availability = { submittedCount: number; groups: { groupId: string; assigned: number; confirmed: number; canRegister: boolean }[] };
type VolunteerForm = {
  fullName: string; email: string; phoneNumber: string; dateOfBirth: string; occupation: string;
  healthNote: string; skills: string; experience: string; motivation: string;
  emergencyContactName: string; emergencyContactPhone: string; groupIds: string[];
};
const emptyForm: VolunteerForm = {
  fullName: "", email: "", phoneNumber: "", dateOfBirth: "", occupation: "", healthNote: "",
  skills: "", experience: "", motivation: "", emergencyContactName: "", emergencyContactPhone: "", groupIds: [],
};
const phoneFields = {
  phoneNumber: { label: "Số điện thoại", id: "volunteer-phone" },
  emergencyContactPhone: { label: "Số điện thoại liên hệ khẩn cấp", id: "volunteer-emergency-phone" },
};
type PhoneField = keyof typeof phoneFields;
const phoneFormat = /^\+?[0-9 ()-]{8,30}$/;
const phoneHint = "Nhập số theo dạng 0912 345 678 hoặc +84912345678.";

function invalidPhoneField(form: VolunteerForm): PhoneField | undefined {
  if (!phoneFormat.test(form.phoneNumber)) return "phoneNumber";
  if (form.emergencyContactPhone && !phoneFormat.test(form.emergencyContactPhone)) return "emergencyContactPhone";
}

function ReviewFields({ fields }: { fields: [string, string][] }) {
  return <dl className={styles.reviewFields}>
    {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}

export default function VolunteerRegistrationWizard({ campaign, active, onDonate }: {
  campaign: Campaign; active: boolean; onDonate: () => void;
}) {
  const { user, login } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [openings, setOpenings] = useState<Openings>();
  const [availability, setAvailability] = useState<Availability>();
  const [dates, setDates] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [phoneIssue, setPhoneIssue] = useState<PhoneField>();
  const [submitPhoneIssue, setSubmitPhoneIssue] = useState<PhoneField>();
  const [busy, setBusy] = useState(false);
  const [submission, setSubmission] = useState<"sent" | "existing">();
  const [submittedId, setSubmittedId] = useState<string>();
  const alreadySubmitted = submission === "existing";
  const [agreed, setAgreed] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [focusId, setFocusId] = useState<string>();

  useEffect(() => {
    if (!active || !focusId) return;
    const target = document.getElementById(focusId);
    if (focusId === "volunteer-form-title") {
      target?.focus({ preventScroll: true });
      target?.closest("[data-participation-scroll]")?.scrollTo({ top: 0 });
    } else {
      target?.focus();
    }
    setFocusId(undefined);
  }, [active, focusId]);

  function changeStep(next: 1 | 2, target = next === 1 ? "volunteer-dates-title" : "volunteer-form-title") {
    setFocusId(target);
    setStep(next);
  }

  function showPhoneIssue(field: PhoneField) {
    setPhoneIssue(field);
    if (field === "emergencyContactPhone") setShowExtras(true);
    changeStep(1, phoneFields[field].id);
  }

  function editApplication(target?: string) {
    setError("");
    setSubmitPhoneIssue(undefined);
    if (target === "volunteer-extras") setShowExtras(true);
    changeStep(1, target);
  }

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({ ...current, fullName: user.fullName, email: user.email }));
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    api<Openings>(`/api/campaigns/${campaign.id}/volunteer-openings`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setOpenings(value); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    api<Availability>(`/api/volunteers/campaigns/${campaign.id}/availability`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setAvailability(result); }).catch(() => undefined);
    return () => controller.abort();
  }, [campaign.id, loadAttempt]);

  useEffect(() => {
    if (active) return;
    setPassword("");
    setConfirmPassword("");
  }, [active]);

  function update<K extends keyof VolunteerForm>(key: K, value: VolunteerForm[K]) {
    if (key === phoneIssue) setPhoneIssue(undefined);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleGroup(groupId: string) {
    update("groupIds", form.groupIds.includes(groupId)
      ? form.groupIds.filter((id) => id !== groupId) : [...form.groupIds, groupId]);
  }

  async function submitApplication(account: Account) {
    return api<{ id: string }>("/api/volunteers/registrations", {
      method: "POST",
      body: JSON.stringify({
        campaignId: campaign.id,
        groupIds: form.groupIds,
        fullName: account.fullName,
        email: account.email,
        phoneNumber: form.phoneNumber,
        dateOfBirth: form.dateOfBirth || null,
        occupation: form.occupation,
        healthNote: form.healthNote,
        skills: form.skills,
        experience: form.experience,
        motivation: form.motivation,
        emergencyContactName: form.emergencyContactName,
        emergencyContactPhone: form.emergencyContactPhone,
        availableDates: dates,
        agreedToTerms: agreed,
      }),
    });
  }

  async function finish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!openings || busy) return;
    setError("");
    setSubmitPhoneIssue(undefined);
    if (dates.length === 0) {
      setError("Hãy chọn ít nhất một ngày bạn có thể tham gia.");
      changeStep(1);
      return;
    }
    const invalidPhone = invalidPhoneField(form);
    if (invalidPhone) {
      showPhoneIssue(invalidPhone);
      return;
    }
    setBusy(true);
    try {
      let account = user;
      if (!account) {
        if (!form.fullName.trim() || !form.email.trim()) throw new Error("Hãy nhập họ tên và email ở bước đầu.");
        if (authMode === "register") {
          if (password !== confirmPassword) throw new Error("Mật khẩu xác nhận chưa khớp.");
          await api("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ fullName: form.fullName, email: form.email, password }),
          });
        }
        account = await login(form.email, password);
        setForm((current) => ({ ...current, fullName: account!.fullName, email: account!.email }));
      }
      try {
        const result = await submitApplication(account);
        setSubmittedId(result.id);
        setSubmission("sent");
      } catch (failure) {
        if (!(failure instanceof ApiError) || failure.status !== 409 ||
          failure.message !== "Bạn đã gửi hồ sơ tình nguyện cho chiến dịch này.") throw failure;
        setSubmission("existing");
      }
      setFocusId("volunteer-form-title");
    } catch (failure) {
      const message = (failure as Error).message;
      const rejectedPhone = /\bEmergencyContactPhone\b/i.test(message) ? "emergencyContactPhone"
        : /\bPhoneNumber\b/i.test(message) ? "phoneNumber" : undefined;
      setSubmitPhoneIssue(rejectedPhone);
      setError(rejectedPhone ? `${phoneFields[rejectedPhone].label} chưa đúng định dạng. ${phoneHint}` : message);
      setFocusId("volunteer-submit-error");
    } finally {
      setBusy(false);
      setPassword("");
      setConfirmPassword("");
    }
  }

  const datesOpen = availability && new Set(openings?.groups.filter((group) => availability.groups.some((item) =>
    item.groupId === group.id && item.canRegister)).map((group) => group.date));
  const openDays = openings?.days.filter((day): day is typeof day & { date: string } =>
    Boolean(day.date && (!datesOpen || datesOpen.has(day.date))));
  const selectedGroups = openings?.groups.filter((group) => form.groupIds.includes(group.id)) ?? [];
  const optionalAnswers: [string, string][] = [
    ["Ngày sinh", form.dateOfBirth && formatCampaignDate(form.dateOfBirth)],
    ["Nghề nghiệp", form.occupation],
    ["Kỹ năng", form.skills],
    ["Kinh nghiệm", form.experience],
    ["Lý do tham gia", form.motivation],
  ];
  const emergencyAnswers: [string, string][] = [
    ["Người liên hệ khẩn cấp", form.emergencyContactName],
    [phoneFields.emergencyContactPhone.label, form.emergencyContactPhone],
  ];
  const optionalFields = optionalAnswers.filter(([, value]) => value.trim());
  const emergencyFields = emergencyAnswers.filter(([, value]) => value.trim());
  const profileHref = submittedId ? `/account/participation/${encodeURIComponent(submittedId)}`
    : `/account/participation?${new URLSearchParams({ campaignId: campaign.id })}`;

  return (
    <section className={styles.panel} aria-labelledby="volunteer-form-title">
      <header className={`${styles.intro} ${step === 2 ? styles.reviewIntro : ""} ${submission === "sent" ? styles.successIntro : ""}`}>
        <h2 id="volunteer-form-title" tabIndex={step === 2 ? -1 : undefined}>
          {alreadySubmitted ? "Bạn đã gửi hồ sơ" : submission === "sent" ? "Đã gửi hồ sơ tình nguyện" : step === 2 ? "Kiểm tra hồ sơ" : "Đăng ký tình nguyện"}
        </h2>
        {!submission && <p>{step === 2 ? "Rà soát lịch đã chọn và thông tin ban tổ chức sẽ dùng để liên hệ với bạn."
          : "Chọn ngày bạn có thể tham gia và gửi hồ sơ để được xếp ca phù hợp."}</p>}
      </header>

      {alreadySubmitted ? (
        <div className={`${styles.success} ${styles.existingNotice}`}>
          <span className={styles.successMark} aria-hidden="true">i</span>
          <p role="status">Tài khoản của bạn đã có hồ sơ cho chiến dịch này. Mở mục Hồ sơ tham gia để xem trạng thái và thông tin xếp ca.</p>
          <div className={styles.actions}>
            <Link href={profileHref} className={styles.primaryButton}>Mở Hồ sơ tham gia</Link>
          </div>
        </div>
      ) : submission === "sent" ? (
        <div className={styles.success} role="status">
          <span className={styles.successMark} aria-hidden="true">✓</span>
          <div><h3>Theo dõi kết quả xếp ca</h3>
            <p>Khi được xếp ca, bạn có thể xem lịch và xác nhận tham gia trong hồ sơ này.</p></div>
          <div className={styles.actions}>
            <Link href={profileHref} className={styles.primaryButton}>Xem hồ sơ đã gửi</Link>
            <button type="button" className={styles.secondaryButton} onClick={onDonate}>Ủng hộ chiến dịch</button>
          </div>
        </div>
      ) : (
        <>
          <ol className={styles.steps} aria-label="Tiến độ đăng ký">
            <li data-complete={step === 2} aria-current={step === 1 ? "step" : undefined}>
              <span aria-hidden="true">{step === 2 ? "✓" : "1"}</span> Lịch và hồ sơ
            </li>
            <li aria-current={step === 2 ? "step" : undefined}>
              <span aria-hidden="true">2</span> Xác nhận và gửi
            </li>
          </ol>

          {error && step === 1 && (
            <div className={styles.feedback} data-error>
              <p role="alert">{error}</p>
              {!openings && (
                <button type="button" className={styles.secondaryButton} onClick={() => {
                  setError("");
                  setLoadAttempt((value) => value + 1);
                }}>Tải lại lịch tuyển</button>
              )}
            </div>
          )}
          {!openings && !error && <p role="status" className={styles.feedback}>Đang tải lịch và nhóm tình nguyện…</p>}
          {openDays?.length === 0 && step === 1 && (
            <p role="status" className={styles.feedback}>
              {datesOpen?.size === 0 ? "Các ca của chiến dịch đã đóng đăng ký." : "Chiến dịch hiện chưa có ngày tuyển tình nguyện."}
            </p>
          )}

          {openDays && openDays.length > 0 && step === 1 && (
            <form onSubmit={(event) => {
              event.preventDefault();
              setError("");
              const invalidPhone = invalidPhoneField(form);
              if (invalidPhone) {
                showPhoneIssue(invalidPhone);
                return;
              }
              changeStep(2);
            }}>
              <div className={styles.formBody}>
                <section className={styles.formSection} aria-labelledby="volunteer-dates-title">
                  <h3 id="volunteer-dates-title" tabIndex={-1}>Lịch tham gia</h3>
                  <p id="volunteer-dates-hint" className={styles.hint}>Chọn ít nhất một ngày bạn có thể tham gia.</p>
                  <fieldset className={styles.dateList} aria-labelledby="volunteer-dates-title" aria-describedby="volunteer-dates-hint">
                    {openDays.map((day) => (
                      <label className={styles.dateOption} key={day.id}>
                        <input type="checkbox" checked={dates.includes(day.date)} onChange={(event) => {
                          setDates((current) => event.target.checked ? [...current, day.date] : current.filter((item) => item !== day.date));
                        }} />
                        <span>
                          <time dateTime={day.date}>{formatCampaignDate(day.date)}</time>
                          {day.title && <small>{day.title}</small>}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </section>

                <section className={styles.formSection} aria-labelledby="volunteer-contact-title">
                  <h3 id="volunteer-contact-title" tabIndex={-1}>Thông tin liên hệ</h3>
                  <p className={styles.hint}>{user ? "Họ tên và email được lấy từ tài khoản của bạn." : "Điền thông tin để ban tổ chức có thể liên hệ với bạn."}</p>
                  <div className={styles.fields}>
                    <label>Họ và tên<input required minLength={2} maxLength={200} autoComplete="name"
                      value={form.fullName} readOnly={!!user} onChange={(event) => update("fullName", event.target.value)} /></label>
                    <label>Email<input required type="email" maxLength={320} autoComplete="email"
                      value={form.email} readOnly={!!user} onChange={(event) => update("email", event.target.value)} /></label>
                    <div className={styles.phoneField}>
                      <label>{phoneFields.phoneNumber.label}<input id={phoneFields.phoneNumber.id} required type="tel" maxLength={30}
                        autoComplete="tel" placeholder="0912 345 678" value={form.phoneNumber}
                        aria-invalid={phoneIssue === "phoneNumber" || undefined}
                        aria-describedby={phoneIssue === "phoneNumber" ? "volunteer-phone-error" : undefined}
                        onChange={(event) => update("phoneNumber", event.target.value)} /></label>
                      {phoneIssue === "phoneNumber" && <p id="volunteer-phone-error" className={styles.inputError}>{phoneHint}</p>}
                    </div>
                  </div>
                </section>

                {openings && openings.groups.length > 0 && (
                  <section className={styles.formSection} aria-labelledby="volunteer-groups-title">
                    <h3 id="volunteer-groups-title">Nhóm tình nguyện</h3>
                    <p className={styles.hint}>Bạn có thể chọn nhóm mình quan tâm. Mục này không bắt buộc.</p>
                    {availability && (
                      <div className={styles.recruitmentInfo}>
                        <p><strong>{availability.submittedCount}</strong> người đã nộp hồ sơ</p>
                        <Legend items={[
                          { label: "Đã xác nhận", tone: "positive" },
                          { label: "Đã xếp, chờ xác nhận", tone: "info" },
                          { label: "Còn trống", tone: "neutral" },
                        ]} />
                      </div>
                    )}
                    <fieldset className={styles.groupList} aria-labelledby="volunteer-groups-title">
                      {openings.groups.map((group) => {
                        const counts = availability?.groups.find((item) => item.groupId === group.id);
                        const queue = !!counts && counts.assigned >= group.target;
                        return (
                          <div className={styles.groupOption} key={group.id}>
                            <label className={styles.groupLabel}>
                              <input type="checkbox" checked={form.groupIds.includes(group.id)}
                                disabled={counts?.canRegister === false} onChange={() => toggleGroup(group.id)} />
                              <span>
                                <strong>{group.name}</strong>
                                <small>{group.category} · Chỉ tiêu {group.target} người</small>
                              </span>
                            </label>
                            <div className={styles.groupDetails}>
                              {(group.dayTitle || group.activityTitle || group.teamName) && (
                                <small>{[group.dayTitle, group.activityTitle, group.teamName && `Đội ${group.teamName}`].filter(Boolean).join(" · ")}</small>
                              )}
                              {group.notes && <small>{group.notes}</small>}
                              {counts && (
                                <div className={styles.capacity}>
                                  <VolunteerCapacity target={group.target} assigned={counts.assigned} confirmed={counts.confirmed} />
                                  <small>{counts.assigned} đã xếp · {counts.confirmed} đã xác nhận</small>
                                  <StatusPill tone={!counts.canRegister ? "neutral" : queue ? "warning" : "positive"}>
                                    {!counts.canRegister ? "Đã đóng" : queue ? "Danh sách chờ" : "Đang nhận hồ sơ"}
                                  </StatusPill>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </fieldset>
                  </section>
                )}

                <details className={styles.extras} open={showExtras}
                  onToggle={(event) => setShowExtras(event.currentTarget.open)}>
                  <summary id="volunteer-extras"><span>Thông tin bổ sung</span><small>Không bắt buộc</small></summary>
                  <div className={styles.fields}>
                    <label>Ngày sinh<input type="date" autoComplete="bday" value={form.dateOfBirth}
                      onChange={(event) => update("dateOfBirth", event.target.value)} /></label>
                    <label>Nghề nghiệp<input maxLength={200} value={form.occupation}
                      onChange={(event) => update("occupation", event.target.value)} /></label>
                    <label className={styles.fullField}>Kỹ năng<input maxLength={2000} placeholder="Sơ cứu, hậu cần, truyền thông…"
                      value={form.skills} onChange={(event) => update("skills", event.target.value)} /></label>
                    <label className={styles.fullField}>Kinh nghiệm<textarea maxLength={3000} rows={2} value={form.experience}
                      onChange={(event) => update("experience", event.target.value)} /></label>
                    <label className={styles.fullField}>Lý do bạn muốn tham gia<textarea maxLength={3000} rows={3} value={form.motivation}
                      onChange={(event) => update("motivation", event.target.value)} /></label>
                    <label>Người liên hệ khẩn cấp<input maxLength={200} value={form.emergencyContactName}
                      onChange={(event) => update("emergencyContactName", event.target.value)} /></label>
                    <div className={styles.phoneField}>
                      <label>{phoneFields.emergencyContactPhone.label}<input id={phoneFields.emergencyContactPhone.id} type="tel"
                        maxLength={30} value={form.emergencyContactPhone} placeholder="0912 345 678"
                        aria-invalid={phoneIssue === "emergencyContactPhone" || undefined}
                        aria-describedby={phoneIssue === "emergencyContactPhone" ? "volunteer-emergency-phone-error" : undefined}
                        onChange={(event) => update("emergencyContactPhone", event.target.value)} /></label>
                      {phoneIssue === "emergencyContactPhone" && <p id="volunteer-emergency-phone-error" className={styles.inputError}>{phoneHint}</p>}
                    </div>
                  </div>
                </details>
              </div>
              <div className={styles.formFooter}>
                <label className={styles.agreement}>
                  <input type="checkbox" required checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                  Tôi đồng ý với điều khoản tham gia tình nguyện.
                </label>
                <div className={styles.actions}>
                  <button type="submit" className={styles.primaryButton} disabled={!openDays.some((day) => dates.includes(day.date))}>
                    Xem lại hồ sơ <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {openings && step === 2 && (
            <form onSubmit={finish}>
              <div className={`${styles.formBody} ${styles.reviewBody}`}>
                <section className={styles.reviewSchedule} aria-labelledby="volunteer-review-dates">
                  <div className={styles.reviewSectionHeading}>
                    <h3 id="volunteer-review-dates">Lịch đã chọn</h3>
                    <button type="button" className={styles.editButton} onClick={() => editApplication()} disabled={busy}>Sửa lịch</button>
                  </div>
                  <ul className={styles.reviewDates}>
                    {[...dates].sort().map((date) => {
                      const day = openings.days.find((item) => item.date === date);
                      return <li key={date}>
                        <time dateTime={date}>{formatCampaignDate(date)}</time>
                        {day?.title && <span>{day.title}</span>}
                      </li>;
                    })}
                  </ul>
                  {selectedGroups.length > 0 && <div className={styles.reviewGroups}>
                    <h4>Nhóm quan tâm</h4>
                    <ul>{selectedGroups.map((group) => <li key={group.id}>{group.name}</li>)}</ul>
                  </div>}
                </section>

                <div className={styles.reviewDetails} data-with-extras={optionalFields.length > 0 || emergencyFields.length > 0}>
                  <section aria-labelledby="volunteer-review-contact">
                    <div className={styles.reviewSectionHeading}>
                      <h3 id="volunteer-review-contact">Thông tin liên hệ</h3>
                      <button type="button" className={styles.editButton} disabled={busy}
                        onClick={() => editApplication("volunteer-contact-title")}>Sửa liên hệ</button>
                    </div>
                    <ReviewFields fields={[["Họ và tên", form.fullName], ["Email", form.email], [phoneFields.phoneNumber.label, form.phoneNumber]]} />
                  </section>
                  {(optionalFields.length > 0 || emergencyFields.length > 0) && (
                    <section aria-labelledby="volunteer-review-extras">
                      <div className={styles.reviewSectionHeading}>
                        <h3 id="volunteer-review-extras">Thông tin bổ sung</h3>
                        <button type="button" className={styles.editButton} disabled={busy}
                          onClick={() => editApplication("volunteer-extras")}>Sửa bổ sung</button>
                      </div>
                      {optionalFields.length > 0 && <ReviewFields fields={optionalFields} />}
                      {emergencyFields.length > 0 && <div className={styles.reviewEmergency}>
                        <h4>Liên hệ khẩn cấp</h4>
                        <ReviewFields fields={emergencyFields} />
                      </div>}
                    </section>
                  )}
                </div>

                {!user && (
                  <section className={styles.authBox} aria-labelledby="volunteer-auth-title">
                    <h3 id="volunteer-auth-title">Tài khoản gửi hồ sơ</h3>
                    <p className={styles.hint}>Đăng nhập hoặc tạo tài khoản bằng email <strong>{form.email}</strong> để gửi hồ sơ.</p>
                    <div className={styles.authToggle} role="group" aria-label="Lựa chọn tài khoản">
                      <button type="button" aria-pressed={authMode === "login"} disabled={busy} onClick={() => {
                        setAuthMode("login");
                        setError("");
                      }}>Đăng nhập</button>
                      <button type="button" aria-pressed={authMode === "register"} disabled={busy} onClick={() => {
                        setAuthMode("register");
                        setError("");
                      }}>Tạo tài khoản</button>
                    </div>
                    {authMode === "register" && <p className={styles.hint}>Mật khẩu mới cần ít nhất 12 ký tự.</p>}
                    <div className={styles.fields}>
                      <label>Mật khẩu<input required type="password" minLength={authMode === "register" ? 12 : undefined} maxLength={128}
                        autoComplete={authMode === "register" ? "new-password" : "current-password"} value={password}
                        onChange={(event) => setPassword(event.target.value)} /></label>
                      {authMode === "register" && <label>Xác nhận mật khẩu<input required type="password" minLength={12} maxLength={128}
                        autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
                    </div>
                  </section>
                )}
              </div>
              <div className={`${styles.formFooter} ${styles.reviewFooter}`}>
                {error && <div className={styles.submitFeedback}>
                  <div id="volunteer-submit-error" role="alert" tabIndex={-1}>
                    <strong>Chưa gửi được hồ sơ</strong>
                    <p>{error}</p>
                  </div>
                  {submitPhoneIssue && <button type="button" className={styles.editButton} onClick={() => {
                    setError("");
                    setSubmitPhoneIssue(undefined);
                    showPhoneIssue(submitPhoneIssue);
                  }}>Sửa {phoneFields[submitPhoneIssue].label.toLocaleLowerCase("vi-VN")}</button>}
                </div>}
                <p className={styles.afterSubmit}>Theo dõi kết quả xếp ca trong <strong>Hồ sơ tham gia</strong> sau khi gửi.</p>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => editApplication()}>
                    <span aria-hidden="true">←</span> Sửa hồ sơ
                  </button>
                  <button type="submit" className={styles.primaryButton} disabled={busy}>
                    {busy ? "Đang gửi hồ sơ…" : user ? "Gửi hồ sơ" : authMode === "register" ? "Tạo tài khoản và gửi" : "Đăng nhập và gửi"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
