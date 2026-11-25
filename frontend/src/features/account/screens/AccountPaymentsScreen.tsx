"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import styles from "@/features/account/Account.module.css";
import Protected from "@/features/auth/components/Protected";
import { api } from "@/shared/api/api";
import { ProcessSteps, ProgressTrack, StatusPill } from "@/shared/ui/StatusVisuals";
import { ActivityList, ActivityPager, historyTime, useActivityList } from "../components/AccountActivity";

type Payment = { id: string; campaignId: string; campaignTitle: string; targetName: string; amount: number;
  status: string; reference: string; expiresAt: string; confirmedAt: string | null };
type Pledge = { id: string; campaignId: string; targetName: string; quantity: number; receivedQuantity: number; unit: string;
  status: string; scheduledAt: string | null; expiresAt: string | null; completedAt: string | null };
type Point = { address: string; receivingHours: string; contact: string };

const statuses: Record<string, string> = {
  PENDING: "Đang chờ", OTP_PENDING: "Chờ OTP", CONFIRMED: "Đã xác nhận", EXPIRED: "Hết hạn",
  APPROVED: "Đang hẹn giao", RECEIVED: "Đã nhận đủ", REJECTED: "Đã từ chối", CANCELLED: "Đã hủy",
};
const duration = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const pledgePath = "/api/donations/in-kind/me";
const pledgeSteps = ["Đặt lịch", "Giao tại điểm nhận", "Nhận đủ hiện vật"];
const pledgeTone = (status: string) => status === "RECEIVED" ? "positive" : status === "APPROVED" ? "info" : status === "PENDING" ? "warning" : "neutral";

function PaymentRow({ row }: { row: Payment }) {
  const pending = ["PENDING", "OTP_PENDING"].includes(row.status) && Date.parse(row.expiresAt) > Date.now();
  const status = !pending && ["PENDING", "OTP_PENDING"].includes(row.status) ? "EXPIRED" : row.status;
  return <div id={"payment-" + row.id}>
    <strong>{row.campaignTitle} · {duration.format(row.amount)}</strong>
    <StatusPill tone={status === "CONFIRMED" ? "positive" : pending ? "warning" : "neutral"}>{statuses[status] ?? status}</StatusPill>
    <span>{row.targetName} · Sandbox</span>
    <span>Mã tham chiếu {row.reference}{row.confirmedAt && " · " + historyTime(row.confirmedAt)}</span>
    {pending && <Link href={`/chien-dich/${row.campaignId}?tham-gia=ung-ho&donation=${row.id}`}>Tiếp tục xác nhận OTP</Link>}
    <Link href={`/chien-dich/${row.campaignId}`}>Mở chiến dịch</Link>
  </div>;
}

function Payments() {
  const money = useActivityList<Payment>("/api/donations/me");
  const goods = useActivityList<Pledge>(pledgePath);
  const [payment, setPayment] = useState<Payment>();
  const [pledge, setPledge] = useState<Pledge>();
  const [point, setPoint] = useState<Point>();
  const [date, setDate] = useState("");
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const scheduled = pledge?.status === "APPROVED" && pledge.scheduledAt && Date.parse(pledge.expiresAt || "") > Date.now();
  const campaignId = pledge?.campaignId;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(window.location.search);
    const report = (error: Error) => { if (!controller.signal.aborted) setDetailError(error.message); };
    const paymentId = query.get("payment"), pledgeId = query.get("pledge");
    if (paymentId) api<Payment>("/api/donations/" + encodeURIComponent(paymentId), { signal: controller.signal }).then(setPayment).catch(report);
    if (pledgeId) api<Pledge>(pledgePath + "/" + encodeURIComponent(pledgeId), { signal: controller.signal }).then(setPledge).catch(report);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setPoint(undefined);
    if (!campaignId) return;
    const controller = new AbortController();
    api<Point>(`/api/donations/campaigns/${campaignId}/in-kind/point`, { signal: controller.signal })
      .then(setPoint).catch(() => {});
    return () => controller.abort();
  }, [campaignId]);

  async function update(change: boolean, event?: FormEvent) {
    event?.preventDefault();
    if (!pledge || busy || (!change && !window.confirm("Bạn muốn hủy phần hiện vật chưa giao?"))) return;
    setBusy(true);
    setDetailError("");
    try {
      setPledge(await api<Pledge>("/api/donations/in-kind/appointments/" + pledge.id, {
        method: change ? "PUT" : "DELETE", body: change ? JSON.stringify({ scheduledAt: new Date(date).toISOString() }) : undefined,
      }));
      setEdit(false);
      goods.reload();
    } catch (reason) {
      setDetailError((reason as Error).message);
      try { setPledge(await api<Pledge>(pledgePath + "/" + pledge.id)); goods.reload(); } catch { /* Keep the server message. */ }
    } finally { setBusy(false); }
  }

  return <div className={styles.accountSubpage}>
    <header className={`${styles.accountPageHeading} ${styles.activityHero}`}><h1>Ủng hộ của tôi</h1>
      <p>Theo dõi giao dịch sandbox, lịch giao và số hiện vật được tiếp nhận.</p></header>
    {detailError && <p role="alert">{detailError}</p>}
    {payment && <ActivityList title="Giao dịch từ thông báo"><PaymentRow row={payment} /></ActivityList>}
    <ActivityList title="Ủng hộ tiền">
      {money.error && <p role="alert">{money.error} <button onClick={money.reload}>Tải lại</button></p>}
      {money.loading ? <p role="status">Đang tải giao dịch…</p> : !money.error && money.rows.length === 0 &&
        <p>Chưa có giao dịch trên trang này. <Link href="/chien-dich">Xem chiến dịch</Link></p>}
      {money.rows.filter((row) => row.id !== payment?.id).map((row) => <PaymentRow key={row.id} row={row} />)}
      <ActivityPager page={money.page} next={money.rows.length === 20} disabled={money.loading} onChange={money.setPage} />
    </ActivityList>
    <ActivityList title="Ủng hộ hiện vật">
      {goods.error && <p role="alert">{goods.error} <button onClick={goods.reload}>Tải lại</button></p>}
      {goods.loading ? <p role="status">Đang tải lịch giao…</p> : !goods.error && goods.rows.length === 0 && <p>Chưa có lịch giao trên trang này.</p>}
      {goods.rows.map((row) => <div key={row.id} data-active={pledge?.id === row.id}><strong>{row.targetName}</strong>
        <StatusPill tone={pledgeTone(row.status)}>{statuses[row.status] ?? row.status}</StatusPill>
        <span>Đã nhận {row.receivedQuantity}/{row.quantity} {row.unit}</span>
        {row.scheduledAt && <span>Lịch giao {historyTime(row.scheduledAt)}</span>}
        <button type="button" aria-expanded={pledge?.id === row.id} aria-controls="pledge-detail" disabled={busy}
          onClick={() => { setPledge(row); setEdit(false); setDetailError(""); }}>Xem lịch giao</button>
      </div>)}
      <ActivityPager page={goods.page} next={goods.rows.length === 20} disabled={goods.loading || busy} onChange={goods.setPage} />
    </ActivityList>
    {pledge && <ActivityList id="pledge-detail" title={pledge.targetName}>
      <p><StatusPill tone={pledgeTone(pledge.status)}>{statuses[pledge.status] ?? pledge.status}</StatusPill></p>
      {["APPROVED", "RECEIVED"].includes(pledge.status) &&
        <ProcessSteps labels={pledgeSteps} current={pledge.receivedQuantity > 0 ? 2 : 1} finished={pledge.status === "RECEIVED"} />}
      <p><strong>Đã nhận {pledge.receivedQuantity}/{pledge.quantity} {pledge.unit}</strong></p>
      <ProgressTrack limit={pledge.quantity} segments={[{ value: pledge.receivedQuantity, tone: "positive" }]}
        label={`Đã thực nhận ${pledge.receivedQuantity} trên ${pledge.quantity} ${pledge.unit}`} />
      <div>
        {pledge.completedAt && <span>Hoàn tất {historyTime(pledge.completedAt)}</span>}
        {pledge.scheduledAt && <span>Lịch giao {historyTime(pledge.scheduledAt)}</span>}
        {point && <span>{[point.address, point.receivingHours, point.contact].filter(Boolean).join(" · ")}</span>}
        <Link href={`/chien-dich/${pledge.campaignId}`}>Mở chiến dịch</Link>
        {scheduled && <button disabled={busy} onClick={() => { setEdit(!edit); setDate(""); }}>Đổi lịch</button>}
        {(scheduled || pledge.status === "PENDING") && <button disabled={busy} onClick={() => void update(false)}>Hủy lịch</button>}
      </div>
      {edit && scheduled && <form onSubmit={(event) => void update(true, event)}>
        <label>Ngày và giờ giao theo thiết bị <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <button disabled={busy}>Lưu lịch mới</button>
      </form>}
    </ActivityList>}
  </div>;
}

export default function AccountPaymentsScreen() {
  return <Protected><Payments /></Protected>;
}
