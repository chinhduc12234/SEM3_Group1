"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { api } from "@/shared/api/api";
import type { Campaign } from "../../types/campaigns";
import css from "./DonationPanel.module.css";
import CampaignDonationDisclosure from "./CampaignDonationDisclosure";
import { DonationBankDetails, DonationMoneyImpact } from "./DonationImpact";
import { DonationSteps, MoneyGiftForm, MoneyReceipt, SandboxPayment } from "./DonationMoneyFlow";
import type { Donation, DonationSummary, OtpChallenge } from "./donationTypes";


export default function DonationPanel({ campaign, resumeId, onVolunteer }: {
  campaign: Campaign; resumeId?: string; onVolunteer: () => void;
}) {
  const { user, loading } = useAuth();
  const targets = campaign.publicPlan?.fundingTargets;
  const [summary, setSummary] = useState<DonationSummary>();
  const [summaryError, setSummaryError] = useState("");
  const [summaryRevision, setSummaryRevision] = useState(0);
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("500000");
  const [publishDonorName, setPublishDonorName] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [donation, setDonation] = useState<Donation>();
  const createRequest = useRef<{ body: string; id: string }>(undefined);
  const [payerAccountNumber, setPayerAccountNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [focusVersion, setFocusVersion] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const workflow = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const accountId = user?.id;

  useEffect(() => {
    if (!focusVersion || !panel.current?.getClientRects().length) return;
    workflow.current?.focus({ preventScroll: true });
    panel.current.closest("[data-participation-scroll]")?.scrollTo({ top: 0 });
  }, [focusVersion]);

  useEffect(() => {
    if (error) feedback.current?.focus();
  }, [error]);

  useEffect(() => {
    setDonation(undefined);
    setOtpChallenge(undefined);
    setOtp("");
    setPayerAccountNumber("");
    createRequest.current = undefined;
    setResumeChecked(false);
    if (!accountId || !resumeId) return;
    const controller = new AbortController();
    api<Donation>(`/api/donations/${resumeId}`, { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted && value.campaignId === campaign.id) setDonation(value);
    }).catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setResumeChecked(true); });
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
    api<DonationSummary>(`/api/donations/campaigns/${campaign.id}/summary`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSummary(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setSummaryError(failure.message); });
    return () => controller.abort();
  }, [campaign.id, summaryRevision]);

  useEffect(() => {
    if (summary) {
      const openTargets = (targets ?? []).filter((target) =>
        !summary.targets.find((progress) => progress.budgetItemId === target.id)?.isComplete);
      setTargetId((current) => openTargets.some((target) => target.id === current) ? current : openTargets[0]?.id ?? "");
    } else if (targets?.length) {
      setTargetId((current) => current || targets[0].id);
    }
  }, [targets, summary]);

  function refreshProgress() {
    setSummaryError("");
    setSummaryRevision((value) => value + 1);
    setFocusVersion((value) => value + 1);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError("");
    try {
      const input = { campaignId: campaign.id, budgetItemId: targetId, amount: Number(amount), publishDonorName };
      const body = JSON.stringify(input);
      if (createRequest.current?.body !== body) createRequest.current = { body, id: crypto.randomUUID() };
      const created = await api<Donation>("/api/donations", {
        method: "POST", body: JSON.stringify({ ...input, requestId: createRequest.current.id }),
      });
      createRequest.current = undefined;
      setDonation(created);
      setFocusVersion((value) => value + 1);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function issueOtp() {
    if (!donation || busy) return;
    setBusy(true);
    setError("");
    try {
      const challenge = await api<OtpChallenge>(`/api/donations/${donation.id}/sandbox/otp`, {
        method: "POST", body: JSON.stringify({ payerAccountNumber }),
      });
      setOtpChallenge(challenge);
      setDonation({ ...donation, status: "OTP_PENDING" });
      setOtp("");
      setFocusVersion((value) => value + 1);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function confirmPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!donation || !otpChallenge || busy) return;
    setBusy(true);
    setError("");
    try {
      const confirmed = await api<Donation>(`/api/donations/${donation.id}/sandbox/confirm`, {
        method: "POST", body: JSON.stringify({ otp }),
      });
      setDonation(confirmed);
      setOtpChallenge(undefined);
      setOtp("");
      setPayerAccountNumber("");
      refreshProgress();
      window.dispatchEvent(new Event("giveaid-notifications-changed"));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  const bank = campaign.publicPlan?.receiving?.bank;
  const resumeQuery = resumeId ? `&donation=${resumeId}` : "";
  const loginPath = `/login?${new URLSearchParams({ returnTo: `/chien-dich/${campaign.id}?tham-gia=ung-ho${resumeQuery}` })}`;
  const openMoneyTargets = (targets ?? []).filter((target) => !summary?.targets.find((progress) => progress.budgetItemId === target.id)?.isComplete);
  const canStart = !!summary && !summary.isClosed && (summary.moneyAvailability ?? "OPEN") === "OPEN" && openMoneyTargets.length > 0;
  const hasContext = !!summary || !!bank;
  const resuming = !!accountId && !!resumeId && !resumeChecked;

  function restartMoney() {
    setDonation(undefined);
    setError("");
    setFocusVersion((value) => value + 1);
  }

  return (
    <section className={css.panel} ref={panel} aria-labelledby="donation-title">
      <header className={css.intro}>
        <h2 id="donation-title">Ủng hộ tài chính</h2>
      </header>
      <p className={css.sandbox}>
        <strong>Thanh toán mô phỏng</strong>
        <span>Chỉ dùng số tài khoản thử nghiệm. Hệ thống không chuyển tiền hoặc gửi SMS thật.</span>
      </p>
      {summaryError && <div className={css.summaryError} role="status">
        <div><strong>Chưa tải được tiến độ ủng hộ</strong><p>{summaryError}</p></div>
        <button type="button" className={css.secondary} onClick={() => {
          setSummaryError("");
          setSummaryRevision((value) => value + 1);
        }}>Tải lại</button>
      </div>}
      {!summary && !summaryError && <p className={css.loading} role="status">Đang tải thông tin ủng hộ…</p>}

      <div className={css.layout} data-context={hasContext}>
        <section className={css.workflow} ref={workflow} tabIndex={-1} aria-label="Thao tác ủng hộ tài chính" aria-busy={busy}>
          {error && <p ref={feedback} tabIndex={-1} className={css.error} role="alert">{error}</p>}
          {resuming && <p role="status">Đang mở giao dịch của bạn…</p>}

          {summary?.isClosed && !donation && !resuming && <section className={css.empty} role="status">
            <h3>Đã đạt mục tiêu ủng hộ</h3>
            <p>Chiến dịch đã dừng nhận thêm khoản ủng hộ.</p>
          </section>}

          {!resuming && (canStart || donation) && donation?.status !== "EXPIRED" &&
            <DonationSteps current={donation ? otpChallenge ? 2 : 1 : 0} finished={donation?.status === "CONFIRMED"} />}

          {canStart && loading && <p role="status">Đang kiểm tra trạng thái đăng nhập…</p>}
          {!donation && canStart && !user && !loading && <section className={css.empty}>
            <h3>Đăng nhập để ủng hộ</h3>
            <p>Bạn có thể theo dõi giao dịch mô phỏng và nhận thông báo xác nhận trong tài khoản.</p>
            <Link className={css.primary} href={loginPath}>Đăng nhập <span aria-hidden="true">→</span></Link>
          </section>}

          {canStart && user && !donation && !resuming &&
            <MoneyGiftForm targets={openMoneyTargets} targetId={targetId} amount={amount}
              publicName={publishDonorName} busy={busy} onTarget={setTargetId} onAmount={setAmount}
              onPublicName={setPublishDonorName} onSubmit={create} />}

          {donation && ["PENDING", "OTP_PENDING"].includes(donation.status) &&
            <SandboxPayment donation={donation} challenge={otpChallenge} payerAccount={payerAccountNumber} otp={otp} busy={busy}
              onPayerAccount={setPayerAccountNumber} onOtp={setOtp} onIssueOtp={() => void issueOtp()} onConfirm={confirmPayment} />}

          {donation?.status === "CONFIRMED" &&
            <MoneyReceipt donation={donation} onRestart={restartMoney} onVolunteer={onVolunteer} />}

          {donation?.status === "EXPIRED" && <section className={css.empty} role="status">
            <h3>Đã hết thời gian xác nhận</h3>
            <p>Giao dịch <code>{donation.reference}</code> đã hết hạn.</p>
            <button type="button" className={css.primary} onClick={restartMoney}>Tạo khoản ủng hộ mới</button>
          </section>}

          {summary && !summary.isClosed && !canStart && !donation && !resuming && (
            <section className={css.empty} role="status">
              <h3>{summary.moneyAvailability === "SCHEDULED" ? "Chưa đến ngày mở ủng hộ tài chính" : "Hiện chưa nhận ủng hộ tài chính"}</h3>
              <p>{!targets?.length ? "Chiến dịch chưa công bố mục tiêu theo từng khoản chi."
                : !openMoneyTargets.length ? "Các mục tiêu theo từng khoản đã đủ."
                : "Bạn có thể theo dõi tiến độ của chiến dịch."}</p>
            </section>
          )}
        </section>

        {hasContext && <div className={css.context}>
          {summary && <DonationMoneyImpact summary={summary} />}
          {summary && <CampaignDonationDisclosure campaignId={campaign.id} revision={summaryRevision} />}
          {bank && <DonationBankDetails bank={bank} campaignId={campaign.id} />}
        </div>}
      </div>
    </section>
  );
}
