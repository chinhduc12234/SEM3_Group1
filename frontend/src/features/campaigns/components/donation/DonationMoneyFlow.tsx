import type { FormEventHandler } from "react";
import type { PublicCampaignPlan } from "../../types/campaigns";
import { StatusPill } from "@/shared/ui/StatusVisuals";
import css from "./DonationPanel.module.css";
import { money, type Donation, type OtpChallenge } from "./donationTypes";

const steps = ["Chọn khoản", "Tài khoản thử", "Xác nhận OTP"];
const amounts = [100_000, 200_000, 500_000];

export function DonationSteps({ current, finished }: { current: number; finished: boolean }) {
  return <ol className={css.steps} aria-label="Tiến độ ủng hộ">
    {steps.map((label, index) => {
      const done = finished || index < current;
      return <li key={label} aria-current={!finished && index === current ? "step" : undefined} data-done={done}>
        <span aria-hidden="true">{done ? "✓" : index + 1}</span>{label}
      </li>;
    })}
  </ol>;
}

export function MoneyGiftForm({ targets, targetId, amount, publicName, busy, onTarget, onAmount, onPublicName, onSubmit }: {
  targets: NonNullable<PublicCampaignPlan["fundingTargets"]>;
  targetId: string;
  amount: string;
  publicName: boolean;
  busy: boolean;
  onTarget: (value: string) => void;
  onAmount: (value: string) => void;
  onPublicName: (value: boolean) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  return <form className={css.form} onSubmit={onSubmit}>
    <h3>Chọn khoản ủng hộ</h3>
    <label>Khoản bạn muốn ủng hộ
      <select required value={targetId} onChange={(event) => onTarget(event.target.value)}>
        {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select>
    </label>
    <fieldset className={css.presets}>
      <legend>Chọn nhanh số tiền</legend>
      <div>
        {amounts.map((preset) => <button type="button" className={css.preset} key={preset} disabled={busy}
          aria-pressed={Number(amount) === preset} onClick={() => onAmount(String(preset))}>{money(preset)}</button>)}
      </div>
    </fieldset>
    <label>Số tiền ủng hộ
      <span className={css.amountField}>
        <input required type="number" inputMode="numeric" min={1} max={1_000_000_000_000_000} step={1}
          aria-describedby="donation-currency" value={amount} onChange={(event) => onAmount(event.target.value)} />
        <span id="donation-currency">VND</span>
      </span>
    </label>
    <label className={css.checkbox}>
      <input type="checkbox" checked={publicName} onChange={(event) => onPublicName(event.target.checked)} />
      Hiện tên của tôi trong kê khai công khai
    </label>
    <button type="submit" className={css.primary} disabled={busy || !targetId}>
      {busy ? "Đang tạo khoản ủng hộ…" : "Tiếp tục ủng hộ"} <span aria-hidden="true">→</span>
    </button>
  </form>;
}

export function SandboxPayment({ donation, challenge, payerAccount, otp, busy, onPayerAccount, onOtp, onIssueOtp, onConfirm }: {
  donation: Donation;
  challenge?: OtpChallenge;
  payerAccount: string;
  otp: string;
  busy: boolean;
  onPayerAccount: (value: string) => void;
  onOtp: (value: string) => void;
  onIssueOtp: () => void;
  onConfirm: FormEventHandler<HTMLFormElement>;
}) {
  return <section className={css.payment} aria-label="Thanh toán mô phỏng">
    <div className={css.paymentSummary}>
      <div><p>{donation.targetName}</p><strong>{money(donation.amount)}</strong></div>
      <StatusPill tone="warning">{challenge ? "Chờ xác nhận OTP" : "Chờ thanh toán"}</StatusPill>
      <p className={css.reference}>Mã giao dịch <code>{donation.reference}</code></p>
    </div>
    {challenge ? <form className={css.form} onSubmit={onConfirm}>
      <h3>Xác nhận mã OTP</h3>
      <p role="status">Tài khoản thử •••• {challenge.payerAccountLast4} · Mã hết hạn lúc {new Date(challenge.expiresAt).toLocaleTimeString("vi-VN")}.</p>
      {challenge.testOtp && <p className={css.testOtp}>Mã OTP thử nghiệm <strong>{challenge.testOtp}</strong></p>}
      <label>Nhập mã OTP 6 số
        <input className={css.otpInput} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
          minLength={6} maxLength={6} value={otp} onChange={(event) => onOtp(event.target.value)} />
      </label>
      <div className={css.actions}>
        <button type="submit" className={css.primary} disabled={busy || otp.length !== 6}>
          {busy ? "Đang xử lý…" : "Xác nhận OTP"}
        </button>
        <button type="button" className={css.secondary} disabled={busy} onClick={onIssueOtp}>Gửi lại OTP</button>
      </div>
    </form> : <form className={css.form} onSubmit={(event) => { event.preventDefault(); onIssueOtp(); }}>
      <h3>Nhập tài khoản thử nghiệm</h3>
      <p>Dùng một dãy 6–20 chữ số để nhận mã OTP mô phỏng.</p>
      <label>Số tài khoản thanh toán thử nghiệm
        <input required inputMode="numeric" autoComplete="off" pattern="[0-9]{6,20}" minLength={6} maxLength={20}
          placeholder="Nhập 6–20 chữ số" value={payerAccount} onChange={(event) => onPayerAccount(event.target.value)} />
      </label>
      <button type="submit" className={css.primary} disabled={busy}>{busy ? "Đang gửi mã…" : "Gửi OTP thử nghiệm"}</button>
    </form>}
  </section>;
}

export function MoneyReceipt({ donation, onRestart, onVolunteer }: {
  donation: Donation;
  onRestart: () => void;
  onVolunteer: () => void;
}) {
  return <section className={css.receipt}>
    <div role="status">
      <p className={css.receiptLabel}><span aria-hidden="true">✓</span> Giao dịch thử nghiệm hoàn tất</p>
      <h3>Đã ghi nhận ủng hộ mô phỏng</h3>
      <dl>
        <div><dt>Số tiền</dt><dd className={css.receiptAmount}>{money(donation.amount)}</dd></div>
        <div><dt>Khoản ủng hộ</dt><dd>{donation.targetName}</dd></div>
        <div><dt>Mã giao dịch</dt><dd><code>{donation.reference}</code></dd></div>
      </dl>
    </div>
    <div className={css.actions}>
      <button type="button" className={css.primary} onClick={onRestart}>Tạo giao dịch thử khác</button>
      <button type="button" className={css.secondary} onClick={onVolunteer}>Đăng ký tình nguyện</button>
    </div>
  </section>;
}
