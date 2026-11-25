"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/shared/api/api";
import { StatusPill } from "@/shared/ui/StatusVisuals";
import css from "./CampaignDonationsTab.module.css";

type Target = { budgetItemId: string; name: string; unit: string };
type Receipt = { id: string; receivedAt: string; lines: { budgetItemId: string; quantity: number }[];
  reversesReceiptId: string | null; reversalReason: string | null; isReversed: boolean };
type ReceiptLine = { id: number; budgetItemId: string; quantity: string; pledgeId: string };

export default function InKindReceiptForm({ campaignId, targets, onReceived, allowReversal = true }: {
  campaignId: string; targets: Target[]; onReceived: () => void; allowReversal?: boolean;
}) {
  const [point, setPoint] = useState<{ id: string; address: string }>();
  const [lines, setLines] = useState<ReceiptLine[]>([{ id: 0, budgetItemId: "", quantity: "", pledgeId: "" }]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reverseId, setReverseId] = useState("");
  const nextLine = useRef(1);
  const attempt = useRef<{ body: string; requestId: string }>(undefined);
  const adjustment = useRef<{ body: string; requestId: string }>(undefined);
  const endpoint = `/api/donations/campaigns/${campaignId}/in-kind`;

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([api<{ id: string; address: string }>(`${endpoint}/point`, options), api<Receipt[]>(`${endpoint}/receipts`, options)])
      .then(([currentPoint, currentReceipts]) => { setPoint(currentPoint); setReceipts(currentReceipts); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [endpoint]);

  function update(id: number, field: keyof Omit<ReceiptLine, "id">, value: string) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!point || busy) return;
    const payload = { pointId: point.id, lines: lines.map(line => ({ budgetItemId: line.budgetItemId,
      quantity: Number(line.quantity), pledgeId: line.pledgeId.trim() || null })) };
    const body = JSON.stringify(payload);
    if (attempt.current?.body !== body) attempt.current = { body, requestId: crypto.randomUUID() };
    setBusy(true); setError(""); setMessage("");
    try {
      const receipt = await api<Receipt>(`${endpoint}/receipts`, { method: "POST",
        body: JSON.stringify({ ...payload, requestId: attempt.current.requestId }) });
      setReceipts(current => [receipt, ...current.filter(item => item.id !== receipt.id)].slice(0, 20));
      setLines([{ id: nextLine.current++, budgetItemId: "", quantity: "", pledgeId: "" }]);
      attempt.current = undefined;
      setMessage(`Đã ghi nhận ${receipt.lines.length} dòng thực nhận.`);
      onReceived();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function reverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reverseId || busy) return;
    const reason = String(new FormData(event.currentTarget).get("reason"));
    const body = JSON.stringify({ reverseId, reason });
    if (adjustment.current?.body !== body) adjustment.current = { body, requestId: crypto.randomUUID() };
    setBusy(true); setError(""); setMessage("");
    try {
      const receipt = await api<Receipt>(`${endpoint}/receipts/${reverseId}/reverse`, { method: "POST",
        body: JSON.stringify({ reason, requestId: adjustment.current.requestId }) });
      setReceipts((current) => [receipt, ...current.filter((item) => item.id !== receipt.id)
        .map((item) => item.id === reverseId ? { ...item, isReversed: true } : item)].slice(0, 20));
      setReverseId("");
      adjustment.current = undefined;
      setMessage("Đã điều chỉnh toàn bộ phiếu. Có thể lập phiếu mới với số thực nhận đúng.");
      onReceived();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  return <section className={css.receiptSurface} aria-labelledby="receipt-heading">
    <header className={css.receiptHeading}>
      <div><h4 id="receipt-heading">Ghi nhận hiện vật theo lô</h4>{point && <p>{point.address}</p>}</div>
      <StatusPill tone="info">{lines.length} dòng đang nhập</StatusPill>
    </header>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={submit}>
      {lines.map(line => <div key={line.id} className={`${css.filters} ${css.receiptLine}`}>
        <label>Hạng mục<select required value={line.budgetItemId} onChange={event => update(line.id, "budgetItemId", event.target.value)}>
          <option value="">Chọn hạng mục</option>
          {targets.map(target => <option key={target.budgetItemId} value={target.budgetItemId}>{target.name} · {target.unit}</option>)}
        </select></label>
        <label>Số thực nhận<input required type="number" min="0.01" step="0.01" value={line.quantity} onChange={event => update(line.id, "quantity", event.target.value)} /></label>
        <label>Mã lịch giao, nếu có<input maxLength={36} value={line.pledgeId} onChange={event => update(line.id, "pledgeId", event.target.value)} /></label>
        {lines.length > 1 && <button type="button" disabled={busy} onClick={() => setLines(current => current.filter(item => item.id !== line.id))}>Bỏ dòng</button>}
      </div>)}
      <div className={css.filters}>
        <button type="button" disabled={busy || lines.length >= 100} onClick={() => setLines(current => [...current,
          { id: nextLine.current++, budgetItemId: "", quantity: "", pledgeId: "" }])}>Thêm dòng</button>
        <button type="submit" disabled={busy || !point}>Ghi nhận lô</button>
      </div>
    </form>
    {!!receipts.length && <details className={css.receiptArchive}><summary>Phiếu tiếp nhận gần đây</summary><ul>
      {receipts.map(item => <li key={item.id}>
        <div className={css.receiptHeading}><strong>{new Date(item.receivedAt).toLocaleString("vi-VN")} · {item.lines.length} dòng</strong>
          <StatusPill tone={item.reversesReceiptId || item.isReversed ? "warning" : "positive"}>
            {item.reversesReceiptId ? "Phiếu điều chỉnh" : item.isReversed ? "Đã điều chỉnh" : "Đã ghi nhận"}
          </StatusPill></div>
        <code>{item.id}</code>
        {item.reversesReceiptId && <p>Điều chỉnh phiếu {item.reversesReceiptId} · {item.reversalReason}</p>}
        {allowReversal && !item.isReversed && !item.reversesReceiptId && <button type="button" disabled={busy}
          onClick={() => setReverseId(reverseId === item.id ? "" : item.id)}>Điều chỉnh</button>}
        {reverseId === item.id && <form onSubmit={reverse}><label>Lý do điều chỉnh toàn bộ phiếu
          <input name="reason" minLength={5} maxLength={1000} required /></label>
          <button disabled={busy}>Lưu điều chỉnh</button></form>}
      </li>)}
    </ul></details>}
  </section>;
}
