import { Legend, ProgressTrack, Stat, StatGrid, StatusPill } from "@/shared/ui/StatusVisuals";
import styles from "./FundraisingProgress.module.css";

export type MoneyTarget = { budgetItemId: string; name: string; targetAmount: number; donatedAmount: number; remainingAmount: number; isComplete: boolean; satisfiedByInKind: boolean };
export type GoodsTarget = { budgetItemId: string; name: string; targetQuantity: number; unit: string; receivedQuantity: number; reservedQuantity: number; remainingQuantity: number; availableToSchedule?: number; isComplete: boolean; satisfiedByMoney: boolean };
type MoneySummary = { targetAmount: number; donatedAmount: number; remainingAmount: number; confirmedDonationCount: number; targets: MoneyTarget[] };

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const numbers = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const money = (value: number) => currency.format(value);
const quantity = (value: number, unit: string) => numbers.format(value) + " " + unit;

export function MoneyProgress({ summary, pendingCount }: { summary: MoneySummary; pendingCount?: number }) {
  return <section className={styles.progress} aria-label="Tiến độ ủng hộ tiền">
    <StatGrid label="Tổng quan ủng hộ tiền">
      <Stat label="Đã xác nhận" value={money(summary.donatedAmount)} detail={`${summary.confirmedDonationCount} lượt ủng hộ`} tone="positive" />
      <Stat label="Mục tiêu" value={money(summary.targetAmount)} />
      <Stat label="Còn cần huy động" value={money(summary.remainingAmount)} tone={summary.remainingAmount > 0 ? "warning" : "neutral"} />
      {pendingCount !== undefined && <Stat label="Giao dịch đang chờ" value={pendingCount} tone={pendingCount ? "warning" : "neutral"} />}
    </StatGrid>
    {summary.targets.length > 0 && <div className={styles.cards}>
      {summary.targets.map((target) => <article className={styles.item} key={target.budgetItemId}>
        <div className={styles.title}><strong>{target.name}</strong>
          {target.isComplete && <StatusPill tone="positive">{target.satisfiedByInKind ? "Đã đủ bằng hiện vật" : "Đã đạt"}</StatusPill>}
        </div>
        <ProgressTrack limit={target.targetAmount} segments={[{ value: target.donatedAmount, tone: "positive" }]}
          label={`${target.name}: đã xác nhận ${money(target.donatedAmount)} trên ${money(target.targetAmount)}`} />
        <div className={styles.numbers}><span><b>{money(target.donatedAmount)}</b> / {money(target.targetAmount)}</span>
          {!target.isComplete && <span>Còn thiếu {money(target.remainingAmount)}</span>}</div>
      </article>)}
    </div>}
  </section>;
}

export function GoodsProgress({ targets }: { targets: GoodsTarget[] }) {
  if (!targets.length) return null;
  return <section className={styles.progress} aria-label="Tiến độ tiếp nhận hiện vật">
    <h4>Tiến độ tiếp nhận hiện vật</h4>
    <Legend items={[{ label: "Đã thực nhận", tone: "positive" }, { label: "Đã hẹn, chờ giao", tone: "info" },
      { label: "Chưa có lịch", tone: "neutral" }]} />
    <div className={styles.cards}>{targets.map((target) => {
      const unreserved = target.availableToSchedule ?? Math.max(0, target.remainingQuantity - target.reservedQuantity);
      return <article className={styles.item} key={target.budgetItemId}>
        <div className={styles.title}><strong>{target.name}</strong>
          <StatusPill tone={target.isComplete ? "positive" : unreserved > 0 ? "neutral" : "info"}>
            {target.satisfiedByMoney ? "Đã đủ bằng tiền" : target.isComplete ? "Đã nhận đủ" : unreserved > 0 ? "Còn nhận" : "Đang chờ giao"}
          </StatusPill>
        </div>
        <ProgressTrack limit={target.targetQuantity} segments={[
          { value: target.receivedQuantity, tone: "positive" }, { value: target.reservedQuantity, tone: "info" },
        ]} label={`${target.name}: đã nhận ${quantity(target.receivedQuantity, target.unit)}, chờ giao ${quantity(target.reservedQuantity, target.unit)}, mục tiêu ${quantity(target.targetQuantity, target.unit)}`} />
        <div className={styles.numbers}>
          <span><b>{quantity(target.receivedQuantity, target.unit)}</b> đã nhận / {quantity(target.targetQuantity, target.unit)}</span>
          {target.reservedQuantity > 0 && <span>{quantity(target.reservedQuantity, target.unit)} chờ giao</span>}
          {unreserved > 0 && !target.isComplete && <span>Còn hẹn được {quantity(unreserved, target.unit)}</span>}
        </div>
      </article>;
    })}</div>
  </section>;
}
