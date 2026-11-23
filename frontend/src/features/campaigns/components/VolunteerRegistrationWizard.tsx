"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/components/AuthProvider";
import type { Campaign } from "@/features/campaigns/types/campaigns";
import type { CampaignSubmissionDetails } from "@/features/campaigns/types/submission";
import { api, type Account } from "@/shared/api/api";
import styles from "./VolunteerRegistrationWizard.module.css";

type OpeningGroup = {
  id: string; name: string; category: string; target: number; date: string | null;
  dayTitle: string | null; activityTitle: string | null; teamName: string | null; notes: string;
};
type Openings = { campaignId: string; groups: OpeningGroup[] };
type VolunteerForm = {
  fullName: string; email: string; phoneNumber: string; dateOfBirth: string; occupation: string;
  healthNote: string; skills: string; experience: string; motivation: string;
  emergencyContactName: string; emergencyContactPhone: string; groupIds: string[];
};
const emptyForm: VolunteerForm = {
  fullName: "", email: "", phoneNumber: "", dateOfBirth: "", occupation: "", healthNote: "",
  skills: "", experience: "", motivation: "", emergencyContactName: "", emergencyContactPhone: "", groupIds: [],
};

export default function VolunteerRegistrationWizard({ campaign, details }: {
  campaign: Campaign; details: CampaignSubmissionDetails;
}) {
  const { user, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [openings, setOpenings] = useState<Openings>();
  const [form, setForm] = useState(emptyForm);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({ ...current, fullName: user.fullName, email: user.email }));
  }, [user]);

  async function begin() {
    setOpen(true);
    setStep(1);
    setError("");
    if (openings) return;
    setBusy(true);
    try {
      setOpenings(await api<Openings>(`/api/campaigns/${campaign.id}/volunteer-openings`));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
        commitsToAllDays: true,
        agreedToTerms: true,
      }),
    });
    setSubmitted(true);
  }

  async function finish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!openings || busy) return;
    setError("");
    if (form.groupIds.length === 0) {
      setError("Hãy chọn ít nhất một nhóm tình nguyện bạn muốn tham gia.");
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

  const publicBank = campaign.publicPlan?.receiving?.bank;
  const qrMediaId = publicBank?.qrMediaId ?? campaign.media.find((media) => media.kind === "FUNDRAISING_QR")?.id;
  const bankTransfer = !!publicBank || details.methods?.includes("Chuyển khoản ngân hàng") === true;
  const bankQr = !!qrMediaId;
  const bankName = publicBank?.bankName ||
    (details.bank?.name === "Ngân hàng khác" ? details.bank.otherName : details.bank?.name);

  return <>
    <section className={styles.callout} aria-labelledby="volunteer-callout-title">
      <div>
        <p className={styles.kicker}>CÙNG THAM GIA</p>
        <h2 id="volunteer-callout-title">Trở thành tình nguyện viên</h2>
        <p>Chọn nhóm phù hợp và gửi hồ sơ cho quản lý chiến dịch xét duyệt.</p>
      </div>
      <button type="button" className={styles.primaryButton} onClick={() => void begin()}>
        Đăng ký tham gia <span aria-hidden="true">↗</span>
      </button>
    </section>

    {open && <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) setOpen(false);
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="volunteer-form-title">
        <header className={styles.dialogHeader}>
          <div><p className={styles.kicker}>THAM GIA CHIẾN DỊCH</p>
            <h2 id="volunteer-form-title">{submitted ? "Đã gửi hồ sơ" : "Đăng ký tình nguyện"}</h2>
            <p>{campaign.title}</p></div>
          <button type="button" className={styles.close} aria-label="Đóng" onClick={() => setOpen(false)}>×</button>
        </header>
        {submitted ? <div className={styles.success} role="status">
          <span aria-hidden="true">✓</span><h3>Hồ sơ đã được gửi đến quản lý chiến dịch.</h3>
          <p>Bạn có thể theo dõi kết quả xét duyệt trong tài khoản của mình.</p>
          <button type="button" className={styles.primaryButton} onClick={() => setOpen(false)}>Hoàn tất</button>
        </div> : <>
          <div className={styles.progress} aria-label={`Bước ${step} trên 2`}>
            <span className={step === 1 ? styles.activeStep : styles.doneStep}>01 <small>Hồ sơ</small></span>
            <i /><span className={step === 2 ? styles.activeStep : ""}>02 <small>Thông tin chiến dịch</small></span>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!openings && !error && <p role="status" className={styles.loading}>Đang tải các nhóm đang tuyển…</p>}
          {openings && <form onSubmit={step === 1 ? (event) => { event.preventDefault(); setError(""); setStep(2); } : finish}>
            {step === 1 ? <div className={styles.formBody}>
              <p className={styles.sectionLead}>Thông tin liên hệ và nhóm bạn muốn tham gia.</p>
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
              <div className={styles.groupSection}>
                <div><h3>Chọn nhóm tình nguyện</h3><p>Bạn có thể chọn các nhóm phù hợp; quản lý sẽ xác nhận nhóm khi duyệt hồ sơ.</p></div>
                <div className={styles.groupGrid}>{openings.groups.map((group) => {
                  const checked = form.groupIds.includes(group.id);
                  return <label className={`${styles.groupOption} ${checked ? styles.groupSelected : ""}`} key={group.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.id)} />
                    <span className={styles.groupCheck}>{checked ? "✓" : "+"}</span>
                    <span><strong>{group.name}</strong><small>{group.category} · Chỉ tiêu {group.target} người</small>
                      {(group.activityTitle || group.dayTitle || group.teamName) && <small>{[group.dayTitle, group.activityTitle, group.teamName && `Đội ${group.teamName}`].filter(Boolean).join(" · ")}</small>}
                      {group.notes && <small>{group.notes}</small>}</span>
                  </label>;
                })}</div>
              </div>
              <label className={styles.checkRow}><input type="checkbox" required /> Tôi đồng ý với điều khoản tham gia tình nguyện.</label>
              <label className={styles.checkRow}><input type="checkbox" required /> Tôi cam kết tham gia đầy đủ các ngày triển khai của chiến dịch.</label>
              <div className={styles.formActions}><span>Bước 1 / 2</span>
                <button type="submit" className={styles.primaryButton}>Tiếp tục <span aria-hidden="true">→</span></button>
              </div>
            </div> : <div className={styles.formBody}>
              <p className={styles.sectionLead}>Thông tin nhận tài trợ của chiến dịch chỉ để tham khảo; không cần chuyển khoản để đăng ký tình nguyện.</p>
              {(bankTransfer || bankQr) ? <div className={styles.bankCard}>
                <div><span className={styles.kicker}>THÔNG TIN NHẬN TÀI TRỢ CỦA CHIẾN DỊCH</span>
                  {bankTransfer && <dl>
                    <div><dt>Ngân hàng</dt><dd>{bankName || "—"}</dd></div>
                    <div><dt>Chủ tài khoản</dt><dd>{publicBank?.accountHolder || details.bank?.accountHolder || "—"}</dd></div>
                    <div><dt>Số tài khoản</dt><dd>{publicBank?.accountNumber || details.bank?.accountNumber || "—"}</dd></div>
                    {publicBank?.transferNote &&
                      <div><dt>Nội dung chuyển khoản</dt><dd>{publicBank.transferNote}</dd></div>}
                  </dl>}
                </div>
                {bankQr && <figure><img src={"/api/campaigns/" + campaign.id + "/media/" + qrMediaId} alt="Mã QR nhận tài trợ của chiến dịch" /><figcaption>Mã QR nhận tài trợ</figcaption></figure>}
              </div> : <p className={styles.noBank}>Chiến dịch chưa cung cấp thông tin chuyển khoản hoặc mã QR.</p>}
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
            </div>}
          </form>}
        </>}
      </section>
    </div>}
  </>;
}
