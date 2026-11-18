import { useEffect, useState } from "react";
import { apiBlob } from "@/shared/api/api";
import type { BudgetReceiving } from "./budget";
import styles from "../CampaignManagement.module.css";
import finance from "./BudgetDashboard.module.css";

const emptyBank = { bankName: "", accountHolder: "", accountNumber: "", qrMediaId: null, transferNote: "" };
const emptyGoods = { acceptedItems: "", address: "", receivingHours: "", contact: "" };
const bankFields = [
  ["bankName", "Tên ngân hàng", 120], ["accountHolder", "Chủ tài khoản", 150],
  ["accountNumber", "Số tài khoản", 40], ["transferNote", "Hướng dẫn nội dung chuyển khoản", 300],
] as const;
const goodsFields = [
  ["acceptedItems", "Hiện vật tiếp nhận", 1000], ["address", "Địa chỉ nhận hiện vật", 400],
  ["receivingHours", "Khung giờ tiếp nhận", 200], ["contact", "Đầu mối tiếp nhận", 160],
] as const;

function ReceivingQr({ campaignId, mediaId, revision }: { campaignId: string; mediaId: string; revision?: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setUrl("");
    setError(false);
    apiBlob(`/api/campaigns/${campaignId}/media/${mediaId}`).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [campaignId, mediaId, revision]);
  return url ? <img src={url} width={180} height={180} style={{ objectFit: "contain" }} alt="Mã QR chuyển khoản nội bộ" /> :
    <p className="muted">{error ? "Không tải được ảnh QR." : "Đang tải ảnh QR…"}</p>;
}

export function BudgetReceivingSummary({ campaignId, receiving }: { campaignId: string; receiving: BudgetReceiving }) {
  return <section className={styles.reviewBlock}>
    <h3>Phương thức nhận hỗ trợ</h3>
    {receiving.bank && <>
      <h4>Chuyển khoản ngân hàng</h4>
      <dl>{bankFields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{receiving.bank?.[key] || "—"}</dd></div>)}</dl>
      {receiving.bank.qrMediaId && <ReceivingQr campaignId={campaignId} mediaId={receiving.bank.qrMediaId} />}
    </>}
    {receiving.goods && <>
      <h4>Nhận hiện vật</h4>
      <dl>{goodsFields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{receiving.goods?.[key] || "—"}</dd></div>)}</dl>
    </>}
  </section>;
}

export default function BudgetReceivingFields({ receiving, campaignId, revision, onChange, onUpload }: {
  receiving?: BudgetReceiving | null; campaignId: string; revision: string;
  onChange: (receiving: BudgetReceiving) => void; onUpload: (file: File) => void;
}) {
  const bank = receiving?.bank ?? null;
  const goods = receiving?.goods ?? null;
  return <div className={`${styles.detailOperationsGrid} ${finance.columns}`}>
    <section className={styles.reviewBlock}>
      <h3>Chuyển khoản ngân hàng</h3>
      <label className={finance.check}><input type="checkbox" checked={!!bank}
        onChange={(event) => onChange({ bank: event.target.checked ? emptyBank : null, goods })} /> Cấu hình chuyển khoản</label>
      {bank && <>
        {bankFields.map(([key, label, limit]) => <label key={key}>{label}
          <input value={bank[key]} maxLength={limit} onChange={(event) => onChange({ bank: { ...bank, [key]: event.target.value }, goods })} />
        </label>)}
        <label>Ảnh mã QR ngân hàng (PNG hoặc JPG)
          <input type="file" accept=".png,.jpg,.jpeg" onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onUpload(file);
          }} />
        </label>
        {bank.qrMediaId && <>
          <ReceivingQr campaignId={campaignId} mediaId={bank.qrMediaId} revision={revision} />
          <button className="quiet" type="button" onClick={() => onChange({ bank: { ...bank, qrMediaId: null }, goods })}>Bỏ ảnh QR khỏi cấu hình</button>
        </>}
      </>}
    </section>
    <section className={styles.reviewBlock}>
      <h3>Nhận hiện vật</h3>
      <label className={finance.check}><input type="checkbox" checked={!!goods}
        onChange={(event) => onChange({ bank, goods: event.target.checked ? emptyGoods : null })} /> Cấu hình điểm nhận hiện vật</label>
      {goods && goodsFields.map(([key, label, limit]) => <label key={key}>{label}
        <input value={goods[key]} maxLength={limit} onChange={(event) => onChange({ bank, goods: { ...goods, [key]: event.target.value } })} />
      </label>)}
    </section>
  </div>;
}
