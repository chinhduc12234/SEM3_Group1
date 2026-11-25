export type BudgetExpense = {
  id: string; name: string; category: string; quantity: number; unit: string; days: number;
  unitPrice: number; activityId: string | null; notes: string;
  priceBasis?: string | null; actualAmount?: number | null;
};
export type BudgetFunding = { id: string; name: string; amount: number; confirmed: boolean; notes: string };
export type BudgetFundraising = {
  opensOn: string | null; closesOn: string | null; purpose: string; categories: string[];
  allowOverGoal: boolean; shortfallPolicy: string; publicExplanation: string;
};
export type BudgetPlan = {
  expenses: BudgetExpense[]; funding: BudgetFunding[]; minimumAmount: number; rationale: string;
  eventScope: "INDEPENDENT" | "PARENT_ALLOCATION" | null; fundraising: BudgetFundraising;
  receiving?: BudgetReceiving | null;
};
export type BudgetBank = { bankName: string; accountHolder: string; accountNumber: string; qrMediaId: string | null; transferNote: string };
export type BudgetGoods = { acceptedItems: string; address: string; receivingHours: string; contact: string;
  budgetItemIds?: string[] | null; receiverUserIds?: string[] | null; opensAt?: string | null;
  closesAt?: string | null; appointmentsPerHour?: number | null };
export type BudgetReceiving = { bank: BudgetBank | null; goods: BudgetGoods | null };
export type BudgetTotals = {
  estimated: number; confirmedFunding: number; expectedFunding: number; fundraisingGoal: number;
};
export type BudgetView = {
  version: string; plan: BudgetPlan | null; totals: BudgetTotals | null; confirmedAt: string | null;
  confirmedByName: string | null; needsReview: boolean; canEdit: boolean; operationsConfirmed: boolean;
  canRecordActuals: boolean;
  categories: { id: string; name: string }[];
  activities: { id: string; title: string; date: string | null; staffNeeded: number; volunteersNeeded: number }[];
};

export const emptyBudget: BudgetPlan = {
  expenses: [], funding: [], minimumAmount: 0, rationale: "", eventScope: null,
  fundraising: { opensOn: null, closesOn: null, purpose: "", categories: [], allowOverGoal: false, shortfallPolicy: "", publicExplanation: "" },
};
export const eventScopes = {
  INDEPENDENT: "Ngân sách riêng của sự kiện",
  PARENT_ALLOCATION: "Phân bổ từ ngân sách chiến dịch cha",
};
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
export const formatBudgetAmount = (amount: number) => vnd.format(amount);
export const expenseAmount = (expense: BudgetExpense) => expense.quantity * expense.days * expense.unitPrice;

export function calculateBudget(plan: BudgetPlan): BudgetTotals {
  const estimated = plan.expenses.reduce((total, row) => total + expenseAmount(row), 0);
  const confirmedFunding = plan.funding.filter((row) => row.confirmed).reduce((total, row) => total + row.amount, 0);
  const expectedFunding = plan.funding.filter((row) => !row.confirmed).reduce((total, row) => total + row.amount, 0);
  return { estimated, confirmedFunding, expectedFunding, fundraisingGoal: Math.max(estimated - confirmedFunding, 0) };
}
