import { ProgressTrack } from "@/shared/ui/StatusVisuals";
import type { PublicCampaignPlan } from "../../types/campaigns";
import css from "./DonationPanel.module.css";
import { money, type DonationSummary } from "./donationTypes";

export function DonationMoneyImpact({ summary }: { summary: DonationSummary }) {
  const { donatedAmount, targetAmount, remainingAmount, confirmedDonationCount, targets } = summary;
  return <section className={css.impact} aria-labelledby="donation-impact-title">
    <h3 id="donation-impact-title">Tiến độ gây quỹ</h3>
    <p className={css.total}>{money(donatedAmount)}</p>
    <p>Đã xác nhận · {confirmedDonationCount.toLocaleString("vi-VN")} lượt ủng hộ</p>
    <ProgressTrack limit={targetAmount} segments={[{ value: donatedAmount, tone: "positive" }]}
      label={`Đã xác nhận ${money(donatedAmount)} trên mục tiêu ${money(targetAmount)}`} />
    <dl className={css.totals}>
      <div><dt>Mục tiêu</dt><dd>{money(targetAmount)}</dd></div>
      <div><dt>Còn cần huy động</dt><dd>{money(remainingAmount)}</dd></div>
    </dl>
    {targets.length > 0 && <details className={css.targetDetails}>
      <summary>Tiến độ theo từng khoản</summary>
      <ul className={css.targetList}>
        {targets.map((target) => <li key={target.budgetItemId}>
          <strong>{target.name}</strong>
          <ProgressTrack limit={target.targetAmount} segments={[{ value: target.donatedAmount, tone: "positive" }]}
            label={`${target.name}: đã xác nhận ${money(target.donatedAmount)} trên ${money(target.targetAmount)}`} />
          <small>{money(target.donatedAmount)} / {money(target.targetAmount)}</small>
          <small>{target.isComplete ? target.satisfiedByInKind ? "Đã đủ bằng hiện vật" : "Đã đạt mục tiêu"
            : `Còn thiếu ${money(target.remainingAmount)}`}</small>
        </li>)}
      </ul>
    </details>}
  </section>;
}

export function DonationBankDetails({ bank, campaignId }: {
  bank: NonNullable<NonNullable<PublicCampaignPlan["receiving"]>["bank"]>;
  campaignId: string;
}) {
  return <details className={css.disclosure}>
    <summary>Thông tin nhận tài trợ của tổ chức</summary>
    <div className={css.disclosureBody}>
      <p>{bank.bankName} · {bank.accountHolder} · {bank.accountNumber}</p>
      {bank.transferNote && <p>{bank.transferNote}</p>}
      {bank.qrMediaId && <img className={css.bankQr} src={`/api/campaigns/${campaignId}/media/${bank.qrMediaId}`}
        alt="Ảnh QR nhận tài trợ do tổ chức cung cấp" loading="lazy" />}
    </div>
  </details>;
}
