import { BudgetStatus } from "../budget/CampaignBudgetSummary";
import OperationsStatusBadge from "./OperationsStatusBadge";
import styles from "../CampaignManagement.module.css";
import type { Campaign } from "../../types/campaigns";

export default function PlanReadiness({ operationsConfirmedAt, budgetConfirmedAt, budgetNeedsReview }: Pick<Campaign,
  "operationsConfirmedAt" | "budgetConfirmedAt" | "budgetNeedsReview">) {
  return <div className={styles.operationsRowStatus}>
    <OperationsStatusBadge confirmedAt={operationsConfirmedAt} />
    <BudgetStatus confirmedAt={budgetConfirmedAt} needsReview={budgetNeedsReview} />
    {operationsConfirmedAt && budgetConfirmedAt && !budgetNeedsReview && <strong>Sẵn sàng rà soát trước duyệt cuối</strong>}
    {!operationsConfirmedAt && <span>Chờ xác nhận vận hành</span>}
    {!budgetConfirmedAt && !budgetNeedsReview && <span>Chờ xác nhận ngân sách</span>}
  </div>;
}
