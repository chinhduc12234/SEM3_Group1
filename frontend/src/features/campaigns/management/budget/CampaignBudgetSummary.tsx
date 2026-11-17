import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "../CampaignManagement.module.css";
import { eventScopes, expenseAmount, formatBudgetAmount, type BudgetPlan, type BudgetTotals, type BudgetView } from "./budget";
import { BudgetReceivingSummary } from "./BudgetReceivingFields";

export function BudgetStatus({ confirmedAt, needsReview }: Pick<BudgetView, "confirmedAt" | "needsReview">) {
  return <span className={styles.operationsBadge} data-confirmed={!!confirmedAt}>
    {confirmedAt ? "Ngân sách đã xác nhận" : needsReview ? "Ngân sách cần rà soát" : "Chờ cập nhật"}
  </span>;
}

export function BudgetFigures({ totals, minimum }: { totals: BudgetTotals; minimum: number }) {
  return <dl className={styles.operationsSummaryStats}>
    <div><dt>Tổng dự toán</dt><dd>{formatBudgetAmount(totals.estimated)}</dd></div>
    <div><dt>Nguồn vốn đã xác nhận</dt><dd>{formatBudgetAmount(totals.confirmedFunding)}</dd></div>
    <div><dt>Nguồn vốn dự kiến</dt><dd>{formatBudgetAmount(totals.expectedFunding)}</dd></div>
    <div><dt>Mục tiêu cần huy động</dt><dd>{formatBudgetAmount(totals.fundraisingGoal)}</dd></div>
    <div><dt>Ngưỡng tối thiểu</dt><dd>{formatBudgetAmount(minimum)}</dd></div>
  </dl>;
}

export function ExpenseVariance({ expense }: { expense: BudgetPlan["expenses"][number] }) {
  const planned = expenseAmount(expense);
  const actual = expense.actualAmount;
  return <dl>
    <dt>Dự toán</dt><dd>{formatBudgetAmount(planned)}</dd>
    <dt>Chi thực tế</dt><dd>{actual == null ? "Chưa ghi nhận" : formatBudgetAmount(actual)}</dd>
    {actual != null && <><dt>Chênh lệch so với dự toán</dt><dd>{formatBudgetAmount(actual - planned)}</dd></>}
  </dl>;
}

export default function CampaignBudgetSummary({ campaignId, view, plan, totals }: {
  campaignId: string; view: BudgetView; plan: BudgetPlan; totals: BudgetTotals;
}) {
  const categories = new Map(view.categories.map((category) => [category.id, category.name]));
  const activities = new Map(view.activities.map((activity) => [activity.id, activity]));
  const { fundraising } = plan;
  return <div className={styles.detailOperationsGrid}>
    <section className={styles.reviewBlock}>
      <h3>Dự toán chi phí</h3>
      {plan.eventScope && <p>{eventScopes[plan.eventScope]}</p>}
      {plan.expenses.length ? plan.expenses.map((expense) => {
        const activity = expense.activityId ? activities.get(expense.activityId) : null;
        return <details key={expense.id} className={styles.operationsSummaryItem}>
          <summary>{expense.name || "Khoản chi chưa có tên"} · {formatBudgetAmount(expenseAmount(expense))}</summary>
          <p>{categories.get(expense.category)} · {expense.quantity} {expense.unit} × {expense.days} ngày × {formatBudgetAmount(expense.unitPrice)}</p>
          {activity && <p>{activity.title} · {formatCampaignDate(activity.date)}</p>}
          {expense.priceBasis && <p><strong>Căn cứ đơn giá</strong><br />{expense.priceBasis}</p>}
          {expense.notes && <p>{expense.notes}</p>}
          <ExpenseVariance expense={expense} />
        </details>;
      }) : <p className="muted">Chưa có khoản chi.</p>}
    </section>
    <section className={styles.reviewBlock}>
      <h3>Nguồn vốn</h3>
      {plan.funding.length ? <ul>{plan.funding.map((source) => <li key={source.id}>
        <strong>{source.name || "Nguồn vốn chưa có tên"}</strong> · {formatBudgetAmount(source.amount)} · {source.confirmed ? "Đã xác nhận" : "Dự kiến"}
        {source.notes && <p>{source.notes}</p>}
      </li>)}</ul> : <p className="muted">Chưa có nguồn vốn.</p>}
      {plan.rationale && <p><strong>Giải trình ngân sách</strong><br />{plan.rationale}</p>}
    </section>
    <section className={styles.reviewBlock}>
      <h3>Kế hoạch gây quỹ</h3>
      {totals.fundraisingGoal > 0 ? <>
        <p>{formatCampaignDate(fundraising.opensOn)} – {formatCampaignDate(fundraising.closesOn)}</p>
        <p><strong>Mục đích sử dụng tiền</strong><br />{fundraising.purpose}</p>
        <p>{fundraising.categories.map((category) => categories.get(category)).join(", ")}</p>
        <p>{fundraising.allowOverGoal ? "Cho phép vượt mục tiêu" : "Dừng ở mức mục tiêu"}</p>
        <p><strong>Xử lý khi thiếu nguồn lực</strong><br />{fundraising.shortfallPolicy}</p>
        <p><strong>Giải thích tài chính dự kiến công khai</strong><br />{fundraising.publicExplanation}</p>
      </> : <p>Đủ nguồn vốn theo dự toán.</p>}
    </section>
    {plan.receiving && (plan.receiving.bank || plan.receiving.goods) &&
      <BudgetReceivingSummary campaignId={campaignId} receiving={plan.receiving} />}
  </div>;
}
