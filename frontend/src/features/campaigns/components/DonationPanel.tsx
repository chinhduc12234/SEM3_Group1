"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import type { Campaign } from "../types/campaigns";
import css from "./DonationPanel.module.css";

type TargetProgress = { budgetItemId: string; name: string; targetAmount: number; donatedAmount: number; remainingAmount: number; isComplete: boolean };
type InKindTarget = { budgetItemId: string; name: string; targetQuantity: number; unit: string; receivedQuantity: number; reservedQuantity: number; remainingQuantity: number; isComplete: boolean };
type Summary = { campaignId: string; targetAmount: number; donatedAmount: number; remainingAmount: number; confirmedDonationCount: number; targets: TargetProgress[]; inKindTargets: InKindTarget[]; isClosed: boolean };
type Donation = { id: string; campaignId: string; budgetItemId: string; campaignTitle: string; targetName: string; amount: number; status: string; paymentMethod: string; reference: string; createdAt: string };
type InKindPledge = { id: string; budgetItemId: string; targetName: string; quantity: number; unit: string; status: string };
type OtpChallenge = { donationId: string; reference: string; payerAccountLast4: string; expiresAt: string; testOtp: string | null };

const amountFormat = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const money = (value: number) => amountFormat.format(value);

function SimulatedQr({ reference }: { reference: string }) {
  const cells = useMemo(() => Array.from({ length: 441 }, (_, index) => {
    const x = index % 21, y = Math.floor(index / 21);
    const inFinder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (inFinder) {
      const localX = x > 13 ? x - 14 : x;
      const localY = y > 13 ? y - 14 : y;
      return localX === 0 || localX === 6 || localY === 0 || localY === 6 ||
        (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4);
    }
    return ((x * 17 + y * 29 + reference.charCodeAt((x + y) % reference.length)) % 7) < 3;
  }), [reference]);
  return <div className={css.qr} role="img" aria-label="Minh họa mã QR mô phỏng, không thể quét">
    {cells.map((on, index) => <i key={index} data-on={on} />)}
  </div>;
}

export default function DonationPanel({ campaign, onClose }: { campaign: Campaign; onClose?: () => void }) {
  const { user, loading } = useAuth();
  const targets = campaign.publicPlan?.fundingTargets ?? [];
  const [summary, setSummary] = useState<Summary>();
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("500000");
  const [donation, setDonation] = useState<Donation>();
  const [payerAccountNumber, setPayerAccountNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [supportMode, setSupportMode] = useState<"money" | "in-kind">("money");
  const [inKindTargetId, setInKindTargetId] = useState("");
  const [inKindQuantity, setInKindQuantity] = useState("1");
  const [inKindNote, setInKindNote] = useState("");
  const [pledge, setPledge] = useState<InKindPledge>();

  useEffect(() => {
    const controller = new AbortController();
    api<Summary>(`/api/donations/campaigns/${campaign.id}/summary`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSummary(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [campaign.id]);
  useEffect(() => {
    if (summary && !summary.targets.some((target) => target.budgetItemId === targetId && !target.isComplete))
      setTargetId(summary.targets.find((target) => !target.isComplete)?.budgetItemId ?? "");
    else if (!summary && !targetId && targets.length) setTargetId(targets[0].id);
  }, [targetId, targets, summary]);
  useEffect(() => {
    if (summary && !summary.inKindTargets.some((item) => item.budgetItemId === inKindTargetId && !item.isComplete))
      setInKindTargetId(summary.inKindTargets.find((item) => !item.isComplete)?.budgetItemId ?? "");
  }, [inKindTargetId, summary]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const created = await api<Donation>("/api/donations", { method: "POST", body: JSON.stringify({
        campaignId: campaign.id, budgetItemId: targetId, amount: Number(amount),
      }) });
      setDonation(created);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function issueOtp() {
    if (!donation || busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const challenge = await api<OtpChallenge>(`/api/donations/${donation.id}/sandbox/otp`, {
        method: "POST", body: JSON.stringify({ payerAccountNumber }),
      });
      setOtpChallenge(challenge);
      setDonation({ ...donation, status: "OTP_PENDING" });
      setOtp("");
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function confirmPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!donation || !otpChallenge || busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const confirmed = await api<Donation>(`/api/donations/${donation.id}/sandbox/confirm`, {
        method: "POST", body: JSON.stringify({ otp }),
      });
      setDonation(confirmed);
      setSuccess(`Đã ghi nhận mô phỏng ${money(confirmed.amount)} cho khoản “${confirmed.targetName}”. Quản lý ngân sách đã được thông báo.`);
      const updated = await api<Summary>(`/api/donations/campaigns/${campaign.id}/summary`);
      setSummary(updated);
      window.dispatchEvent(new Event("giveaid-notifications-changed"));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function submitInKind(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy || !inKindTargetId) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const created = await api<InKindPledge>("/api/donations/in-kind", { method: "POST", body: JSON.stringify({
        campaignId: campaign.id, budgetItemId: inKindTargetId, quantity: Number(inKindQuantity), note: inKindNote,
      }) });
      setPledge(created);
      setSuccess(`Đã gửi đề nghị tặng ${created.quantity} ${created.unit} cho “${created.targetName}”. Quản lý chiến dịch sẽ xét duyệt.`);
      window.dispatchEvent(new Event("giveaid-notifications-changed"));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  const bank = campaign.publicPlan?.receiving?.bank;
  const goods = campaign.publicPlan?.receiving?.goods;
  return <section className={css.panel} aria-labelledby="donation-title">
    <header className={css.intro}>
      <div><p className={css.eyebrow}>ỦNG HỘ TÀI CHÍNH</p><h2 id="donation-title">Góp sức cho khoản cần thiết</h2>
        <p>Chọn một khoản dự toán và số tiền bạn muốn ủng hộ.</p></div>
      <div className={css.headerActions}>
        <span className={css.mockBadge}>Thanh toán mô phỏng</span>
        {onClose && <button type="button" className={css.backButton} onClick={onClose}>← Chọn cách tham gia</button>}
      </div>
    </header>
    {summary && <dl className={css.stats}>
      <div><dt>Mục tiêu cần huy động</dt><dd>{money(summary.targetAmount)}</dd></div>
      <div><dt>Đã xác nhận ủng hộ</dt><dd>{money(summary.donatedAmount)}</dd></div>
      <div><dt>Còn thiếu để đạt mục tiêu</dt><dd>{money(summary.remainingAmount)}</dd></div>
    </dl>}
    {!!summary?.targets.length && <div className={css.progressList} aria-label="Tiến độ theo khoản dự toán">
      {summary.targets.map((target) => <div className={css.target} key={target.budgetItemId}>
        <div className={css.targetHead}><span>{target.name}</span><span>{target.isComplete ? "Đã đạt mục tiêu" : `Còn thiếu ${money(target.remainingAmount)}`}</span></div>
        <progress max={Math.max(target.targetAmount, 1)} value={Math.min(target.donatedAmount, target.targetAmount)} />
        <small>Đã ủng hộ {money(target.donatedAmount)} / {money(target.targetAmount)}</small>
      </div>)}
    </div>}
    {!!summary?.inKindTargets.length && <div className={css.progressList} aria-label="Tiến độ nhận hiện vật">
      <h3 className={css.subheading}>Tiến độ nhận hiện vật</h3>
      {summary.inKindTargets.map((target) => <div className={css.target} key={target.budgetItemId}>
        <div className={css.targetHead}><span>{target.name}</span><span>{target.isComplete ? "Đã nhận đủ" : `Còn thiếu ${target.remainingQuantity} ${target.unit}`}</span></div>
        <progress max={Math.max(target.targetQuantity, 1)} value={Math.min(target.receivedQuantity + target.reservedQuantity, target.targetQuantity)} />
        <small>Đã nhận {target.receivedQuantity} / {target.targetQuantity} {target.unit}{target.reservedQuantity > 0 ? ` · ${target.reservedQuantity} ${target.unit} đã được duyệt, chờ giao` : ""}</small>
      </div>)}
    </div>}
    {!summary && !error && <p role="status">Đang tải tiến độ gây quỹ…</p>}
    {!targets.length && <p className={css.footnote}>Chiến dịch chưa công bố mục tiêu quyên góp theo từng khoản chi.</p>}
    {!user && !loading && <div className={css.login}>Đăng nhập để tạo khoản ủng hộ và nhận thông báo xác nhận. <Link href="/login">Đăng nhập</Link></div>}
    {summary?.isClosed && <div className={css.closed} role="status"><strong>Đã đạt đủ mục tiêu ủng hộ</strong><p>Chiến dịch vẫn tiếp tục, nhưng hiện không nhận thêm tiền hoặc hiện vật.</p></div>}
    {!summary?.isClosed && <div className={css.modeTabs} role="tablist" aria-label="Loại ủng hộ">
      <button type="button" role="tab" aria-selected={supportMode === "money"} onClick={() => setSupportMode("money")}>Ủng hộ tài chính</button>
      <button type="button" role="tab" aria-selected={supportMode === "in-kind"} onClick={() => setSupportMode("in-kind")}>Ủng hộ hiện vật</button>
    </div>}
    {!summary?.isClosed && supportMode === "money" && user && !donation && !!targets.length && <form className={css.form} onSubmit={(event) => void create(event)}>
      <label>Ủng hộ cho khoản<select required value={targetId} onChange={(event) => setTargetId(event.target.value)}>
        {targets.filter((target) => !summary?.targets.find((progress) => progress.budgetItemId === target.id)?.isComplete)
          .map((target) => <option key={target.id} value={target.id}>{target.name} · mục tiêu {money(target.amount)}</option>)}
      </select></label>
      <label>Số tiền (VND)<input required type="number" inputMode="numeric" min={1} max={1_000_000_000_000_000} step={1}
        value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <button type="submit" disabled={busy || !targetId}>{busy ? "Đang tạo…" : "Tiếp tục ủng hộ"} ↗</button>
    </form>}
    {!summary?.isClosed && supportMode === "in-kind" && goods && <div className={css.goodsInfo}>
      <strong>Thông tin giao nhận hiện vật</strong>
      {goods.acceptedItems && <p>Đang nhận: {goods.acceptedItems}</p>}
      {goods.address && <p>Địa chỉ: {goods.address}</p>}
      {goods.receivingHours && <p>Thời gian: {goods.receivingHours}</p>}
      {goods.contact && <p>Liên hệ: {goods.contact}</p>}
    </div>}
    {!summary?.isClosed && supportMode === "in-kind" && !pledge && !!summary?.inKindTargets.length && <form className={css.form} onSubmit={(event) => void submitInKind(event)}>
      <label>Tặng hiện vật<select required value={inKindTargetId} onChange={(event) => setInKindTargetId(event.target.value)}>
        {summary.inKindTargets.filter((target) => !target.isComplete).map((target) => <option key={target.budgetItemId} value={target.budgetItemId}>
          {target.name} · còn thiếu {target.remainingQuantity} {target.unit}
        </option>)}
      </select></label>
      <label>Số lượng<input required type="number" min="1" max={summary.inKindTargets.find((target) => target.budgetItemId === inKindTargetId)?.remainingQuantity ?? 1}
        step="0.01" value={inKindQuantity} onChange={(event) => setInKindQuantity(event.target.value)} /></label>
      <label className={css.fullField}>Ghi chú (không bắt buộc)<input maxLength={1000} value={inKindNote} onChange={(event) => setInKindNote(event.target.value)} placeholder="Loại, kích cỡ hoặc lưu ý giao nhận" /></label>
      <button type="submit" disabled={busy || !user || !inKindTargetId}>{busy ? "Đang gửi…" : "Gửi đề nghị tặng hiện vật"} ↗</button>
    </form>}
    {!summary?.isClosed && supportMode === "in-kind" && !summary?.inKindTargets.length && <p className={css.footnote}>Chiến dịch chưa khai báo chỉ tiêu hiện vật theo từng khoản.</p>}
    {supportMode === "in-kind" && !user && !loading && !summary?.isClosed && <div className={css.login}>Đăng nhập để gửi đề nghị tặng hiện vật. <Link href="/login">Đăng nhập</Link></div>}
    {donation && donation.status !== "CONFIRMED" && <section className={css.success} aria-label="Thanh toán sandbox">
      <div className={css.successHead}><strong>Ủng hộ {money(donation.amount)} cho “{donation.targetName}”</strong><span className={css.mockBadge}>{donation.status === "OTP_PENDING" ? "Chờ OTP" : "Chờ thanh toán"}</span></div>
      <div className={css.qrCard}><SimulatedQr reference={donation.reference} /><div className={css.qrNote}>
        <strong>Thanh toán sandbox · {donation.reference}</strong>
        {bank && <p>Ngân hàng nhận tài trợ của chiến dịch: {bank.bankName}.</p>}
        <p>Đây là mã QR minh họa, không thể quét. Nhập tài khoản thử nghiệm và OTP để đi hết luồng sandbox.</p>
      </div></div>
      {!otpChallenge && <form className={css.otpForm} onSubmit={(event) => { event.preventDefault(); void issueOtp(); }}>
        <label>Số tài khoản thanh toán thử nghiệm
          <input required inputMode="numeric" autoComplete="off" pattern="[0-9]{6,20}" minLength={6} maxLength={20}
            placeholder="Nhập 6–20 chữ số" value={payerAccountNumber} onChange={(event) => setPayerAccountNumber(event.target.value)} />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Đang gửi mã…" : "Gửi OTP sandbox"}</button>
      </form>}
      {otpChallenge && <form className={css.otpForm} onSubmit={(event) => void confirmPayment(event)}>
        <p role="status">Đã gửi OTP giả lập tới tài khoản •••• {otpChallenge.payerAccountLast4}. Mã hết hạn lúc {new Date(otpChallenge.expiresAt).toLocaleTimeString("vi-VN")}.</p>
        {otpChallenge.testOtp && <p className={css.testOtp}>Mã OTP thử nghiệm: <strong>{otpChallenge.testOtp}</strong> · Nhập mã này bên dưới.</p>}
        <label>Nhập mã OTP 6 số<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6}
          value={otp} onChange={(event) => setOtp(event.target.value)} /></label>
        <div className={css.actions}><button type="submit" disabled={busy || otp.length !== 6}>{busy ? "Đang xác nhận…" : "Xác nhận OTP"}</button>
          <button type="button" onClick={() => void issueOtp()} disabled={busy}>Gửi lại OTP</button></div>
      </form>}
      <p className={css.footnote}>Sandbox không kết nối ngân hàng, không gửi SMS và không chuyển tiền thật. OTP thử nghiệm chỉ hiển thị ở môi trường phát triển.</p>
    </section>}
    {donation?.status === "CONFIRMED" && <section className={css.success} role="status">
      <strong>Đã ghi nhận ủng hộ mô phỏng · {donation.reference}</strong>
      {success && <p>{success}</p>}
      <button type="button" onClick={() => { setDonation(undefined); setSuccess(""); }}>Tạo giao dịch thử khác</button>
    </section>}
    {pledge && <section className={css.success} role="status"><strong>Đề nghị tặng hiện vật đã gửi · Chờ quản lý duyệt</strong>
      {success && <p>{success}</p>}<button type="button" onClick={() => { setPledge(undefined); setSuccess(""); }}>Gửi đề nghị khác</button></section>}
    {error && <p className={css.error} role="alert">{error}</p>}
    <p className={css.footnote}>Bản thử nghiệm không kết nối ngân hàng: khoản ủng hộ chỉ được ghi nhận sau khi xác nhận OTP sandbox.</p>
  </section>;
}
