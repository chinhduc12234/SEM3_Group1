"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import { ProcessSteps, StatusPill } from "@/shared/ui/StatusVisuals";
import type { Campaign } from "../types/campaigns";
import css from "./DonationPanel.module.css";
import CampaignDonationDisclosure from "./CampaignDonationDisclosure";
import { GoodsProgress, MoneyProgress, type GoodsTarget as InKindTarget, type MoneyTarget as TargetProgress } from "./FundraisingProgress";
type Summary = { campaignId: string; targetAmount: number; donatedAmount: number; remainingAmount: number; confirmedDonationCount: number; targets: TargetProgress[]; inKindTargets: InKindTarget[]; isClosed: boolean; moneyAvailability?: "OPEN" | "SCHEDULED" | "CLOSED" | "UNAVAILABLE" };
type Donation = { id: string; campaignId: string; budgetItemId: string; campaignTitle: string; targetName: string; amount: number; status: string; paymentMethod: string; reference: string; createdAt: string; expiresAt: string };
type InKindPledge = { id: string; budgetItemId: string; targetName: string; quantity: number; unit: string; status: string; scheduledAt: string };
type OtpChallenge = { donationId: string; reference: string; payerAccountLast4: string; expiresAt: string; testOtp: string | null };

const amountFormat = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const money = (value: number) => amountFormat.format(value);
const paymentSteps = ["Chọn khoản ủng hộ", "Nhập tài khoản thử", "Xác nhận OTP"];

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

export default function DonationPanel({ campaign, initialMode, resumeId, onClose, onVolunteer }: {
  campaign: Campaign; initialMode: "money" | "in-kind"; resumeId?: string; onClose: () => void; onVolunteer: () => void;
}) {
  const { user, loading } = useAuth();
  const targets = campaign.publicPlan?.fundingTargets ?? [];
  const [summary, setSummary] = useState<Summary>();
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("500000");
  const [publishDonorName, setPublishDonorName] = useState(false);
  const [donation, setDonation] = useState<Donation>();
  const createRequest = useRef<{ body: string; id: string }>(undefined);
  const [payerAccountNumber, setPayerAccountNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [supportMode, setSupportMode] = useState(initialMode);
  const [inKindTargetId, setInKindTargetId] = useState("");
  const [inKindQuantity, setInKindQuantity] = useState("1");
  const [inKindNote, setInKindNote] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pledge, setPledge] = useState<InKindPledge>();
  const accountId = user?.id;

  useEffect(() => {
    setDonation(undefined);
    setOtpChallenge(undefined);
    setOtp("");
    setPayerAccountNumber("");
    setPledge(undefined);
    createRequest.current = undefined;
    if (!accountId || !resumeId) return;
    const controller = new AbortController();
    api<Donation>(`/api/donations/${resumeId}`, { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted && value.campaignId === campaign.id) setDonation(value);
    }).catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [accountId, campaign.id, resumeId]);

  useEffect(() => {
    if (!donation || !["PENDING", "OTP_PENDING"].includes(donation.status)) return;
    const timeout = window.setTimeout(() => {
      setDonation((current) => current?.id === donation.id && current.status !== "CONFIRMED"
        ? { ...current, status: "EXPIRED" } : current);
      setOtpChallenge(undefined);
      setOtp("");
      setPayerAccountNumber("");
    }, Math.max(0, new Date(donation.expiresAt).getTime() - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [donation]);

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
    if (summary && !summary.inKindTargets.some((item) => item.budgetItemId === inKindTargetId && !item.isComplete && schedulable(item) >= 1))
      setInKindTargetId(summary.inKindTargets.find((item) => !item.isComplete && schedulable(item) >= 1)?.budgetItemId ?? "");
  }, [inKindTargetId, summary]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const input = { campaignId: campaign.id, budgetItemId: targetId, amount: Number(amount), publishDonorName };
      const body = JSON.stringify(input);
      if (createRequest.current?.body !== body) createRequest.current = { body, id: crypto.randomUUID() };
      const created = await api<Donation>("/api/donations", { method: "POST",
        body: JSON.stringify({ ...input, requestId: createRequest.current.id }) });
      createRequest.current = undefined;
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
      setOtpChallenge(undefined);
      setOtp("");
      setPayerAccountNumber("");
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
      const point = await api<{ id: string }>(`/api/donations/campaigns/${campaign.id}/in-kind/point`);
      const created = await api<InKindPledge>("/api/donations/in-kind/appointments", { method: "POST", body: JSON.stringify({
        campaignId: campaign.id, budgetItemId: inKindTargetId, pointId: point.id,
        scheduledAt: new Date(scheduledAt).toISOString(), quantity: Number(inKindQuantity), note: inKindNote,
      }) });
      setPledge(created);
      setSummary(await api<Summary>(`/api/donations/campaigns/${campaign.id}/summary`));
      window.dispatchEvent(new Event("giveaid-notifications-changed"));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function cancelAppointment() {
    if (!pledge || busy) return;
    setBusy(true); setError("");
    try {
      const cancelled = await api<InKindPledge>(`/api/donations/in-kind/appointments/${pledge.id}`, { method: "DELETE" });
      setPledge(cancelled);
      setSummary(await api<Summary>(`/api/donations/campaigns/${campaign.id}/summary`));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  const bank = campaign.publicPlan?.receiving?.bank;
  const resumeQuery = supportMode === "money" && resumeId ? `&donation=${resumeId}` : "";
  const loginPath = `/login?${new URLSearchParams({ returnTo: `/chien-dich/${campaign.id}?tham-gia=${supportMode === "money" ? "ung-ho" : "hien-vat"}${resumeQuery}` })}`;
  const goods = campaign.publicPlan?.receiving?.goods;
  const openMoneyTargets = targets.filter((target) => !summary?.targets.find((progress) => progress.budgetItemId === target.id)?.isComplete);
  const openInKindTargets = summary?.inKindTargets.filter((target) => !target.isComplete && schedulable(target) >= 1) ?? [];
  const canDonateMoney = summary && !summary.isClosed && (summary.moneyAvailability ?? "OPEN") === "OPEN";
  return <section className={css.panel} aria-labelledby="donation-title">
    <header className={css.intro}>
      <div><h2 id="donation-title">{supportMode === "money" ? "Ủng hộ tài chính" : "Ủng hộ hiện vật"}</h2></div>
      <div className={css.headerActions}>
        {supportMode === "money" && <StatusPill tone="info">Thanh toán mô phỏng</StatusPill>}
        <button type="button" className={css.backButton} onClick={onClose}>← Chọn cách tham gia</button>
      </div>
    </header>
    <div className={css.modeTabs} role="group" aria-label="Loại ủng hộ">
      <button type="button" aria-pressed={supportMode === "money"} onClick={() => setSupportMode("money")}>Ủng hộ tài chính</button>
      <button type="button" aria-pressed={supportMode === "in-kind"} onClick={() => setSupportMode("in-kind")}>Ủng hộ hiện vật</button>
    </div>
    {summary && (supportMode === "money" ? <MoneyProgress summary={summary} /> : <GoodsProgress targets={summary.inKindTargets} />)}
    {summary && supportMode === "money" && <CampaignDonationDisclosure campaignId={campaign.id} />}
    {!summary && !error && <p role="status">Đang tải tiến độ gây quỹ…</p>}
    {!targets.length && supportMode === "money" && <p className={css.footnote}>Chiến dịch chưa công bố mục tiêu quyên góp theo từng khoản chi.</p>}
    {supportMode === "money" && !user && !loading && !summary?.isClosed && <div className={css.login}>Đăng nhập để tạo khoản ủng hộ và nhận thông báo xác nhận. <Link href={loginPath}>Đăng nhập</Link></div>}
    {summary?.isClosed && <div className={css.closed} role="status"><strong>Đã đạt đủ mục tiêu ủng hộ</strong><p>Chiến dịch vẫn tiếp tục, nhưng hiện không nhận thêm tiền hoặc hiện vật.</p></div>}
    {supportMode === "money" && (canDonateMoney || donation) && donation?.status !== "EXPIRED" &&
      <ProcessSteps labels={paymentSteps} current={donation ? otpChallenge ? 2 : 1 : 0}
        finished={donation?.status === "CONFIRMED"} />}
    {supportMode === "money" && bank && <details className={css.goodsInfo}>
      <summary>Thông tin nhận tài trợ của chiến dịch</summary>
      <p>{bank.bankName} · {bank.accountHolder} · {bank.accountNumber}</p>
      {bank.transferNote && <p>{bank.transferNote}</p>}
      {bank.qrMediaId && <img className={css.bankQr} src={`/api/campaigns/${campaign.id}/media/${bank.qrMediaId}`} alt="Ảnh QR nhận tài trợ do tổ chức cung cấp" />}
    </details>}
    {summary && !summary.isClosed && supportMode === "money" && !canDonateMoney && <p role="status">
      {summary.moneyAvailability === "SCHEDULED" ? "Ủng hộ tài chính chưa đến ngày mở." : "Hiện chưa nhận ủng hộ tài chính."}
    </p>}
    {canDonateMoney && supportMode === "money" && user && !donation && openMoneyTargets.length > 0 && <form className={css.form} onSubmit={(event) => void create(event)}>
      <label>Ủng hộ cho khoản<select required value={targetId} onChange={(event) => setTargetId(event.target.value)}>
        {openMoneyTargets.map((target) => <option key={target.id} value={target.id}>{target.name} · mục tiêu {money(target.amount)}</option>)}
      </select></label>
      <label>Số tiền (VND)<input required type="number" inputMode="numeric" min={1} max={1_000_000_000_000_000} step={1}
        value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <button type="submit" disabled={busy || !targetId}>{busy ? "Đang tạo…" : "Tiếp tục ủng hộ"} ↗</button>
      <label className={`${css.fullField} ${css.publishName}`}><input type="checkbox" checked={publishDonorName}
        onChange={(event) => setPublishDonorName(event.target.checked)} /> Hiện tên tôi trong kê khai công khai</label>
    </form>}
    {!summary?.isClosed && supportMode === "money" && summary && targets.length > 0 && openMoneyTargets.length === 0 &&
      <p className={css.footnote}>Các khoản tiền đã đóng vì mục tiêu từng khoản đã đủ bằng tiền hoặc hiện vật.</p>}
    {!summary?.isClosed && supportMode === "in-kind" && goods && <div className={css.goodsInfo}>
      <strong>Thông tin giao nhận hiện vật</strong>
      {goods.acceptedItems && <p>Đang nhận: {goods.acceptedItems}</p>}
      {goods.address && <p>Địa chỉ: {goods.address}</p>}
      {goods.receivingHours && <p>Thời gian: {goods.receivingHours}</p>}
      {goods.contact && <p>Liên hệ: {goods.contact}</p>}
      <p>Bạn có thể đến trực tiếp trong giờ tiếp nhận hoặc đặt lịch giao trước.</p>
    </div>}
    {!summary?.isClosed && summary && supportMode === "in-kind" && user && !pledge && goods && openInKindTargets.length > 0 && <form className={css.form} onSubmit={(event) => void submitInKind(event)}>
      <label>Tặng hiện vật<select required value={inKindTargetId} onChange={(event) => setInKindTargetId(event.target.value)}>
        {openInKindTargets.map((target) => <option key={target.budgetItemId} value={target.budgetItemId}>
          {target.name} · còn hẹn được {schedulable(target)} {target.unit}
        </option>)}
      </select></label>
      <label>Số lượng<input required type="number" min="1" max={schedulable(openInKindTargets.find((target) => target.budgetItemId === inKindTargetId))}
        step="0.01" value={inKindQuantity} onChange={(event) => setInKindQuantity(event.target.value)} /></label>
      <label>Ngày và giờ giao theo thiết bị<input required type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
      <label className={css.fullField}>Ghi chú (không bắt buộc)<input maxLength={1000} value={inKindNote} onChange={(event) => setInKindNote(event.target.value)} placeholder="Loại, kích cỡ hoặc lưu ý giao nhận" /></label>
      <button type="submit" disabled={busy || !inKindTargetId}>{busy ? "Đang đặt…" : "Đặt lịch giao hiện vật"} ↗</button>
    </form>}
    {!summary?.isClosed && summary && supportMode === "in-kind" && summary.inKindTargets.length > 0 && openInKindTargets.length === 0 &&
      <p className={css.footnote}>Hiện chưa còn số lượng để đặt lịch giao. Hãy xem tiến độ thực nhận ở trên.</p>}
    {!summary?.isClosed && supportMode === "in-kind" && !summary?.inKindTargets.length && <p className={css.footnote}>Chiến dịch chưa khai báo chỉ tiêu hiện vật theo từng khoản.</p>}
    {supportMode === "in-kind" && !user && !loading && !summary?.isClosed && <div className={css.login}>Đăng nhập để đặt lịch giao hiện vật. <Link href={loginPath}>Đăng nhập</Link></div>}
    {supportMode === "money" && donation?.status === "EXPIRED" && <section className={css.success} role="status">
      <strong>Giao dịch {donation.reference} đã hết hạn</strong>
      <button type="button" onClick={() => { setDonation(undefined); setError(""); }}>Tạo khoản ủng hộ mới</button>
    </section>}
    {supportMode === "money" && donation && ["PENDING", "OTP_PENDING"].includes(donation.status) && <section className={css.success} aria-label="Thanh toán sandbox">
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
    {supportMode === "money" && donation?.status === "CONFIRMED" && <section className={css.success} role="status">
      <strong>Đã ghi nhận ủng hộ mô phỏng · {donation.reference}</strong>
      {success && <p>{success}</p>}
      <div className={css.actions}><button type="button" onClick={() => { setDonation(undefined); setSuccess(""); }}>Tạo giao dịch thử khác</button>
        <button type="button" onClick={onVolunteer}>Đăng ký tình nguyện</button></div>
    </section>}
    {supportMode === "in-kind" && pledge && <section className={css.success} role="status"><strong>{pledge.status === "CANCELLED" ? "Đã hủy lịch giao" : "Đã xác nhận lịch giao hiện vật"}</strong>
      <p>{pledge.quantity} {pledge.unit} · {pledge.targetName} · {new Date(pledge.scheduledAt).toLocaleString("vi-VN")}</p>
      {pledge.status !== "CANCELLED" && <p>Mã lịch giao <code>{pledge.id}</code></p>}
      <div className={css.actions}><button type="button" onClick={() => setPledge(undefined)}>Đặt lịch khác</button>
        {pledge.status === "APPROVED" && <button type="button" disabled={busy} onClick={() => void cancelAppointment()}>Hủy lịch giao</button>}
        <button type="button" onClick={onVolunteer}>Đăng ký tình nguyện</button></div></section>}
    {error && <p className={css.error} role="alert">{error}</p>}
    {supportMode === "money" && !donation && <p className={css.footnote}>Khoản ủng hộ mô phỏng được ghi nhận sau khi xác nhận OTP sandbox.</p>}
  </section>;
}

function schedulable(target?: InKindTarget) {
  return target?.availableToSchedule ?? target?.remainingQuantity ?? 0;
}
