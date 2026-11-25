"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/components/AuthProvider";
import type { Campaign } from "@/features/campaigns/types/campaigns";
import { api, type Account } from "@/shared/api/api";
import { Legend, ProcessSteps, StatusPill } from "@/shared/ui/StatusVisuals";
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

export default function VolunteerRegistrationWizard({ campaign, active, onClose, onDonate }: {
  campaign: Campaign; active: boolean; onClose: () => void; onDonate: () => void;
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
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

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
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleGroup(groupId: string) {
    update("groupIds", form.groupIds.includes(groupId)
      ? form.groupIds.filter((id) => id !== groupId) : [...form.groupIds, groupId]);
  }

  async function submitApplication(account: Account) {
    await api("/api/volunteers/registrations", {
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
    setSubmitted(true);
  }

  async function finish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!openings || busy) return;
    setError("");
    if (dates.length === 0) {
      setError("Hãy chọn ít nhất một ngày bạn có thể tham gia.");
      setStep(1);
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
      await submitApplication(account);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
      setPassword("");
      setConfirmPassword("");
    }
  }

  const datesOpen = availability && new Set(openings?.groups.filter((group) => availability.groups.some((item) =>
    item.groupId === group.id && item.canRegister)).map((group) => group.date));
  const closed = datesOpen?.size === 0;

  return <section className={styles.panel} aria-labelledby="volunteer-form-title">
        <header className={styles.dialogHeader}>
          <div>
            <h2 id="volunteer-form-title">{submitted ? "Đã gửi hồ sơ" : "Đăng ký tình nguyện"}</h2>
            <p>{campaign.title}</p></div>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>← Chọn cách tham gia</button>
        </header>
        {submitted ? <div className={styles.success} role="status">
          <span aria-hidden="true">✓</span><h3>Đã nhận hồ sơ tình nguyện.</h3>
          <p><a href="/account/history">Xem kết quả và xác nhận ca trong Hoạt động của tôi</a>.</p>
          <button type="button" className={styles.primaryButton} onClick={onDonate}>Ủng hộ thêm cho chiến dịch</button>
        </div> : <>
          <div className={styles.progress}><ProcessSteps labels={["Chọn lịch và điền hồ sơ", "Xác nhận và gửi"]} current={step - 1} /></div>
          {error && <p className={styles.error} role="alert">{error}{!openings && <>
            {" "}<button type="button" className="quiet" onClick={() => { setError(""); setLoadAttempt((value) => value + 1); }}>Tải lại</button>
          </>}</p>}
          {!openings && !error && <p role="status" className={styles.loading}>Đang tải các nhóm đang tuyển…</p>}
          {closed && <p role="status">Các ca của chiến dịch đã đóng đăng ký.</p>}
          {openings && !closed && step === 1 && <form onSubmit={(event) => { event.preventDefault(); setError(""); setStep(2); }}>
            <div className={styles.formBody}>
              <p className={styles.sectionLead}>Chọn ngày có thể tham gia để hệ thống xếp ca phù hợp.</p>
              <div className={styles.fields}>
                <label>Họ và tên<input required minLength={2} maxLength={200} autoComplete="name"
                  value={form.fullName} readOnly={!!user} onChange={(e) => update("fullName", e.target.value)} /></label>
                <label>Email<input required type="email" maxLength={320} autoComplete="email"
                  value={form.email} readOnly={!!user} onChange={(e) => update("email", e.target.value)} /></label>
                <label>Số điện thoại<input required type="tel" maxLength={30} autoComplete="tel" placeholder="0912 345 678"
                  value={form.phoneNumber} onChange={(e) => update("phoneNumber", e.target.value)} /></label>
                <label>Ngày sinh <span>(không bắt buộc)</span><input type="date" value={form.dateOfBirth}
                  onChange={(e) => update("dateOfBirth", e.target.value)} /></label>
                <label>Nghề nghiệp <span>(không bắt buộc)</span><input maxLength={200} value={form.occupation}
                  onChange={(e) => update("occupation", e.target.value)} /></label>
                <label>Kỹ năng <span>(không bắt buộc)</span><input maxLength={2000} placeholder="Sơ cứu, hậu cần, truyền thông…"
                  value={form.skills} onChange={(e) => update("skills", e.target.value)} /></label>
                <label className={styles.fullField}>Kinh nghiệm <span>(không bắt buộc)</span><textarea maxLength={3000} rows={2}
                  value={form.experience} onChange={(e) => update("experience", e.target.value)} /></label>
                <label className={styles.fullField}>Lý do bạn muốn tham gia <span>(không bắt buộc)</span><textarea maxLength={3000} rows={3}
                  value={form.motivation} onChange={(e) => update("motivation", e.target.value)} /></label>
                <label>Người liên hệ khẩn cấp <span>(không bắt buộc)</span><input maxLength={200}
                  value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} /></label>
                <label>Số điện thoại liên hệ khẩn cấp <span>(không bắt buộc)</span><input type="tel" maxLength={30}
                  value={form.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)} /></label>
              </div>
              <fieldset className={styles.groupSection}>
                <legend>Ngày có thể tham gia</legend>
                {openings.days.map((day) => day.date && (!datesOpen || datesOpen.has(day.date)) && <label className={styles.checkRow} key={day.id}>
                  <input type="checkbox" checked={dates.includes(day.date)} onChange={(event) => {
                    const date = day.date!;
                    setDates((current) => event.target.checked ? [...current, date] : current.filter((item) => item !== date));
                  }} /> {day.date} · {day.title}
                </label>)}
              </fieldset>
              <div className={styles.groupSection}>
                <div><h3>Tình hình tuyển theo nhóm</h3>
                  {availability && <p><strong>{availability.submittedCount}</strong> người đã nộp hồ sơ.</p>}
                  <p>Có thể đánh dấu nhóm bạn quan tâm.</p></div>
                {availability && <Legend items={[{ label: "Đã xác nhận", tone: "positive" }, { label: "Đã xếp, chờ xác nhận", tone: "info" },
                  { label: "Còn trống", tone: "neutral" }]} />}
                <div className={styles.groupGrid}>{openings.groups.map((group) => {
                  const checked = form.groupIds.includes(group.id);
                  const counts = availability?.groups.find((item) => item.groupId === group.id);
                  return <label className={`${styles.groupOption} ${checked ? styles.groupSelected : ""}`} key={group.id}>
                    <input type="checkbox" checked={checked} disabled={counts?.canRegister === false} onChange={() => toggleGroup(group.id)} />
                    <span className={styles.groupCheck}>{checked ? "✓" : "+"}</span>
                    <span className={styles.groupContent}><strong>{group.name}</strong><small>{group.category} · Chỉ tiêu {group.target} người</small>
                      {counts && <>
                        <VolunteerCapacity target={group.target} assigned={counts.assigned} confirmed={counts.confirmed} />
                        <small>{counts.assigned} đã xếp · {counts.confirmed} đã xác nhận</small>
                        <StatusPill tone={!counts.canRegister ? "neutral" : counts.assigned >= group.target ? "warning" : "positive"}>
                          {counts.canRegister ? counts.assigned >= group.target ? "Danh sách chờ" : "Đang nhận hồ sơ" : "Đã đóng"}
                        </StatusPill>
                      </>}
                      {(group.activityTitle || group.dayTitle || group.teamName) && <small>{[group.dayTitle, group.activityTitle, group.teamName && `Đội ${group.teamName}`].filter(Boolean).join(" · ")}</small>}
                      {group.notes && <small>{group.notes}</small>}</span>
                  </label>;
                })}</div>
              </div>
              <label className={styles.checkRow}><input type="checkbox" required checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> Tôi đồng ý với điều khoản tham gia tình nguyện.</label>
              <div className={styles.formActions}>
                <button type="submit" disabled={!dates.some((day) => !datesOpen || datesOpen.has(day))} className={styles.primaryButton}>Tiếp tục <span aria-hidden="true">→</span></button>
              </div>
            </div>
          </form>}
          {openings && step === 2 && <form onSubmit={finish}>
              <div className={styles.formBody}>
              <p className={styles.sectionLead}>Kiểm tra lại thông tin trước khi gửi hồ sơ.</p>
              <p><strong>{form.fullName}</strong> · {form.email} · {form.phoneNumber}</p>
              <p>Ngày có thể tham gia · {dates.join(", ")}</p>
              <p>{openings.groups.filter((group) => form.groupIds.includes(group.id)).map((group) => group.name).join(" · ")}</p>
              {!user && <section className={styles.authBox} aria-labelledby="volunteer-auth-title">
                <div className={styles.authHeading}><div><h3 id="volunteer-auth-title">Đăng nhập để gửi hồ sơ</h3>
                  <p>Thông tin hồ sơ đã nhập sẽ được giữ lại.</p></div>
                  <div className={styles.authToggle} role="group" aria-label="Tài khoản">
                    <button type="button" aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setError(""); }}>Đăng nhập</button>
                    <button type="button" aria-pressed={authMode === "register"} onClick={() => { setAuthMode("register"); setError(""); }}>Tạo tài khoản</button>
                  </div></div>
                {authMode === "register" && <p className={styles.authHint}>Tài khoản mới dùng họ tên và email bạn đã điền ở bước 1.</p>}
                <label>Mật khẩu<input required type="password" minLength={authMode === "register" ? 12 : undefined} maxLength={128}
                  autoComplete={authMode === "register" ? "new-password" : "current-password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} /></label>
                {authMode === "register" && <label>Xác nhận mật khẩu<input required type="password" minLength={12} maxLength={128}
                  autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>}
              </section>}
              <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => { setStep(1); setError(""); }}>← Quay lại</button>
                <button type="submit" className={styles.primaryButton} disabled={busy}>
                  {busy ? "Đang gửi hồ sơ…" : user ? "Gửi hồ sơ" : authMode === "register" ? "Tạo tài khoản và gửi" : "Đăng nhập và gửi"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
              </div>
            </form>}
        </>}
      </section>;
}
