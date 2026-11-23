import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { api } from "@/shared/api/api";
import type { Campaign } from "../../types/campaigns";
import { formatCampaignDate } from "../../formatCampaignDate";
import styles from "../CampaignManagement.module.css";
import finance from "./BudgetDashboard.module.css";
import CampaignBudgetSummary, { BudgetFigures, BudgetStatus, ExpenseVariance } from "./CampaignBudgetSummary";
import BudgetReceivingFields from "./BudgetReceivingFields";
import CampaignDonationsTab from "./CampaignDonationsTab";
import { calculateBudget, emptyBudget, eventScopes, expenseAmount, formatBudgetAmount,
  type BudgetExpense, type BudgetFunding, type BudgetPlan, type BudgetView } from "./budget";

const tabs = [["expenses", "Dự toán chi phí"], ["funding", "Nguồn vốn"], ["fundraising", "Kế hoạch gây quỹ"],
  ["receiving", "Phương thức tiếp nhận"], ["overview", "Xem lại"], ["actuals", "Chi thực tế"], ["donations", "Quyên góp"]] as const;

function BudgetItemHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <header className={finance.itemHeader}><h4>{title}</h4>{children && <strong>{children}</strong>}</header>;
}

function textField(label: string, value: string, change: (value: string) => void, maxLength = 200) {
  return <label>{label}<input maxLength={maxLength} value={value} onChange={(event) => change(event.target.value)} /></label>;
}

function longField(label: string, value: string, change: (value: string) => void) {
  return <label>{label}<textarea rows={3} maxLength={2000} value={value} onChange={(event) => change(event.target.value)} /></label>;
}

function numberField(label: string, value: number, change: (value: number) => void, min = 0, max = 1_000_000_000_000_000) {
  return <label>{label}<input type="number" step={1} min={min} max={max} value={value}
    onChange={(event) => change(Number.isNaN(event.target.valueAsNumber) ? min : event.target.valueAsNumber)} /></label>;
}

function updateRow<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>) {
  return rows.map((row) => row.id === id ? { ...row, ...patch } : row);
}

function ActualExpenseForm({ expense, disabled, onSave }: {
  expense: BudgetExpense; disabled: boolean; onSave: (amount: number | null) => void;
}) {
  const [amount, setAmount] = useState(expense.actualAmount?.toString() ?? "");
  const actual = amount === "" ? null : Number(amount);
  const valid = actual === null || (Number.isInteger(actual) && actual >= 0 && actual <= 1_000_000_000_000_000);
  return <section className={styles.operationsItem}>
    <BudgetItemHeader title={expense.name || "Khoản chi chưa có tên"} />
    <ExpenseVariance expense={expense} compact />
    <label>Số tiền đã chi (VND)
      <input type="number" min={0} max={1_000_000_000_000_000} step={1} value={amount}
        disabled={disabled} aria-invalid={!valid} onChange={(event) => setAmount(event.target.value)} />
    </label>
    <button type="button" className="secondary" disabled={disabled || !valid || actual === (expense.actualAmount ?? null)}
      onClick={() => onSave(actual)}>Lưu chi thực tế</button>
  </section>;
}

export default function CampaignBudgetPanel({ campaign }: { campaign: Campaign }) {
  const [view, setView] = useState<BudgetView>();
  const [plan, setPlan] = useState<BudgetPlan>(emptyBudget);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>(campaign.status === "PUBLISHED" ? "actuals" : "expenses");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const endpoint = `/api/campaigns/${campaign.id}/budget`;
  const detail = `/organizations/${campaign.organizationId}/manage/campaigns/${campaign.id}`;
  useEffect(() => {
    const controller = new AbortController();
    api<BudgetView>(endpoint, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setView(result);
      setPlan(result.plan ?? emptyBudget);
    }).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [endpoint, retry]);

  function edit(change: (current: BudgetPlan) => BudgetPlan) {
    setPlan(change);
    setMessage("");
  }

  async function save(confirm: boolean) {
    if (!view?.canEdit || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api<BudgetView>(endpoint, {
        method: "PUT", body: JSON.stringify({ version: view.version, plan, confirm }),
      });
      setView(result);
      setPlan(result.plan ?? emptyBudget);
      if (confirm) setTab("overview");
      setMessage(confirm ? "Đã xác nhận ngân sách." : "Đã lưu bản nháp ngân sách.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveActual(expenseId: string, actualAmount: number | null) {
    if (!view?.canRecordActuals || !view.confirmedAt || plan !== view.plan || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api<BudgetView>(`${endpoint}/expenses/${expenseId}/actual`, {
        method: "PUT", body: JSON.stringify({ version: view.version, actualAmount }),
      });
      setView(result);
      setPlan(result.plan ?? emptyBudget);
      setMessage("Đã lưu chi thực tế.");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadQr(file: File) {
    const bank = plan.receiving?.bank;
    if (!view?.canEdit || !bank || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const body = new FormData();
      body.set("version", view.version);
      body.set("kind", "FUNDRAISING_QR");
      body.set("file", file);
      const updated = await api<Campaign>(`/api/campaigns/${campaign.id}/media`, { method: "POST", body });
      const qrMediaId = updated.media.find((media) => media.kind === "FUNDRAISING_QR")?.id;
      if (!qrMediaId) throw new Error("Không tìm thấy ảnh QR đã tải.");
      setView({ ...view, version: updated.version, confirmedAt: updated.budgetConfirmedAt });
      setPlan({ ...plan, receiving: { bank: { ...bank, qrMediaId }, goods: plan.receiving?.goods ?? null } });
      setMessage("Đã tải ảnh QR. Hãy lưu cấu hình tiếp nhận.");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (view && !view.canEdit && !view.canRecordActuals)
    return <p className="notice">Hồ sơ hiện không cho phép chỉnh sửa ngân sách. Bạn có thể xem dự toán từ trang chi tiết.</p>;

  const totals = calculateBudget(plan);
  const funding = plan.fundraising;
  const coverage = totals.estimated > 0 ? Math.floor(totals.confirmedFunding / totals.estimated * 100) : 0;
  const visibleTabs = tabs.filter(([key]) => view?.canEdit || key === "overview" || key === "actuals" || (key === "donations" && view?.canRecordActuals));
  const activeTabLabel = tabs.find(([key]) => key === tab)?.[1];
  return <section className={finance.editor} aria-labelledby="budget-title">
    <header className={finance.sectionHeader}>
      <div><h2 id="budget-title">Tổng quan ngân sách</h2>
        {view && <BudgetStatus confirmedAt={view.confirmedAt} needsReview={view.needsReview} />}</div>
      {view && <Link className={finance.recordLink} href={`${detail}?tab=operations`}>Xem kế hoạch vận hành <span aria-hidden="true">↗</span></Link>}
    </header>
    {error && <p className="notice error" role="alert">{error} <button className="quiet" type="button" disabled={busy}
      onClick={() => { setError(""); setRetry((count) => count + 1); }}>Tải lại bản đã lưu</button></p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {!view && !error && <p role="status">Đang tải ngân sách…</p>}
    {view && <>
      {view.needsReview && <p className="notice">Lịch hoặc quy mô vận hành đã thay đổi. Hãy rà soát và xác nhận lại dự toán.</p>}
      <BudgetFigures totals={totals} minimum={plan.minimumAmount} dashboard />
      {totals.estimated > 0 && <div className={finance.coverage}>
        <label htmlFor="budget-coverage">Tỷ lệ dự toán đã có vốn <strong>{coverage.toLocaleString()}%</strong></label>
        <progress id="budget-coverage" max={totals.estimated} value={Math.min(totals.confirmedFunding, totals.estimated)} />
      </div>}
      <nav className={finance.tabs} aria-label="Các phần kế hoạch ngân sách">
        {visibleTabs.map(([key, title]) =>
          <button type="button" className="secondary" aria-controls="budget-section"
          aria-pressed={tab === key} key={key} onClick={() => setTab(key)}>{title}</button>)}
      </nav>
      <div className={finance.sectionHeader}><h3 id="budget-section-title">{activeTabLabel}</h3></div>
      <fieldset id="budget-section" aria-labelledby="budget-section-title" className={`${styles.conceptForm} ${finance.form}`} disabled={busy}>
        {tab === "expenses" && <>
          {campaign.concept?.parentCampaignId && <label>Phạm vi ngân sách sự kiện
            <select value={plan.eventScope ?? ""} onChange={(event) => {
              const scope = event.target.value as BudgetPlan["eventScope"] | "";
              edit((current) => ({ ...current, eventScope: scope || null }));
            }}>
              <option value="">Chọn phạm vi</option>
              {Object.entries(eventScopes).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>}
          {plan.expenses.length === 0 && <p className={finance.empty}>Chưa có khoản chi.</p>}
          {plan.expenses.map((expense, index) => {
            const patch = (value: Partial<BudgetExpense>) => edit((current) => ({ ...current, expenses: updateRow(current.expenses, expense.id, value) }));
            return <section className={styles.operationsItem} key={expense.id}>
              <BudgetItemHeader title={expense.name || `Khoản chi ${index + 1}`}>{formatBudgetAmount(expenseAmount(expense))}</BudgetItemHeader>
              <div className={`${styles.operationsFields} ${finance.itemFields}`}>
                {textField("Tên khoản chi", expense.name, (name) => patch({ name }))}
                <label>Nhóm chi phí<select value={expense.category} onChange={(event) => patch({ category: event.target.value })}>
                  {view.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select></label>
                {numberField("Số lượng", expense.quantity, (quantity) => patch({ quantity }), 1, 100000)}
                {textField("Đơn vị", expense.unit, (unit) => patch({ unit }), 40)}
                {numberField("Số ngày", expense.days, (days) => patch({ days }), 1, 366)}
                {numberField("Đơn giá (VND)", expense.unitPrice, (unitPrice) => patch({ unitPrice }))}
                <label>Hoạt động liên quan<select value={expense.activityId ?? ""} onChange={(event) => patch({ activityId: event.target.value || null })}>
                  <option value="">Dùng chung</option>
                  {expense.activityId && !view.activities.some(({ id }) => id === expense.activityId) &&
                    <option value={expense.activityId}>Hoạt động đã thay đổi · Chọn lại</option>}
                  {view.activities.map((activity) => <option key={activity.id} value={activity.id}>
                    {formatCampaignDate(activity.date)} · {activity.title} ({activity.staffNeeded} nhân sự, {activity.volunteersNeeded} TNV)
                  </option>)}
                </select></label>
                {longField("Ghi chú khoản chi", expense.notes, (notes) => patch({ notes }))}
                {longField("Căn cứ đơn giá", expense.priceBasis ?? "", (priceBasis) => patch({ priceBasis }))}
              </div>
              <button type="button" className="quiet" onClick={() => edit((current) => ({ ...current, expenses: current.expenses.filter(({ id }) => id !== expense.id) }))}>Bỏ khoản chi</button>
            </section>;
          })}
          <button type="button" className="secondary" disabled={plan.expenses.length >= 200} onClick={() => {
            const row: BudgetExpense = { id: crypto.randomUUID(), name: "", category: "OTHER", quantity: 1, unit: "", days: 1, unitPrice: 0, activityId: null, notes: "" };
            edit((current) => ({ ...current, expenses: [...current.expenses, row] }));
          }}>Thêm khoản chi</button>
        </>}
        {tab === "funding" && <>
          {plan.funding.length === 0 && <p className={finance.empty}>Chưa có nguồn vốn.</p>}
          {plan.funding.map((source, index) => {
            const patch = (value: Partial<BudgetFunding>) => edit((current) => ({ ...current, funding: updateRow(current.funding, source.id, value) }));
            return <section className={styles.operationsItem} key={source.id}>
              <BudgetItemHeader title={source.name || `Nguồn vốn ${index + 1}`}>{formatBudgetAmount(source.amount)}</BudgetItemHeader>
              <div className={`${styles.operationsFields} ${finance.itemFields}`}>
                {textField("Tên nguồn vốn", source.name, (name) => patch({ name }))}
                {numberField("Số tiền (VND)", source.amount, (amount) => patch({ amount }))}
                <label>Trạng thái nguồn vốn<select value={source.confirmed ? "confirmed" : "expected"}
                  onChange={(event) => patch({ confirmed: event.target.value === "confirmed" })}>
                  <option value="expected">Dự kiến</option><option value="confirmed">Đã xác nhận</option>
                </select></label>
                {longField("Ghi chú nguồn vốn", source.notes, (notes) => patch({ notes }))}
              </div>
              <button type="button" className="quiet" onClick={() => edit((current) => ({ ...current, funding: current.funding.filter(({ id }) => id !== source.id) }))}>Bỏ nguồn vốn</button>
            </section>;
          })}
          <button type="button" className="secondary" disabled={plan.funding.length >= 100} onClick={() => {
            const row: BudgetFunding = { id: crypto.randomUUID(), name: "", amount: 0, confirmed: false, notes: "" };
            edit((current) => ({ ...current, funding: [...current.funding, row] }));
          }}>Thêm nguồn vốn</button>
          <div className={styles.reviewBlock}>
            {numberField("Ngưỡng tối thiểu để triển khai (VND)", plan.minimumAmount, (minimumAmount) => edit((current) => ({ ...current, minimumAmount })))}
            {longField("Giải trình ngân sách và ngưỡng tối thiểu", plan.rationale, (rationale) => edit((current) => ({ ...current, rationale })))}
          </div>
        </>}
        {tab === "fundraising" && <section className={styles.reviewBlock}>
          <p>Mục tiêu cần huy động bằng tổng dự toán trừ nguồn vốn đã xác nhận.</p>
          {totals.fundraisingGoal > 0 && <div className={`${styles.operationsFields} ${finance.itemFields}`}>
            {([["opensOn", "Ngày dự kiến mở quyên góp"], ["closesOn", "Ngày dự kiến kết thúc"]] as const).map(([key, title]) =>
              <label key={key}>{title}<input type="date" value={funding[key] ?? ""} onChange={(event) => {
                const date = event.target.value || null;
                edit((current) => ({ ...current, fundraising: { ...current.fundraising, [key]: date } }));
              }} /></label>)}
            {longField("Mục đích sử dụng tiền", funding.purpose, (purpose) => edit((current) => ({ ...current, fundraising: { ...current.fundraising, purpose } })))}
            {longField("Xử lý khi thiếu nguồn lực", funding.shortfallPolicy, (shortfallPolicy) => edit((current) => ({ ...current, fundraising: { ...current.fundraising, shortfallPolicy } })))}
            {longField("Giải thích tài chính dự kiến công khai", funding.publicExplanation, (publicExplanation) => edit((current) => ({ ...current, fundraising: { ...current.fundraising, publicExplanation } })))}
            <fieldset className={finance.choices}>
              <legend>Nhóm chi phí kêu gọi hỗ trợ</legend>
              {view.categories.filter(({ id }) => funding.categories.includes(id) || plan.expenses.some((row) => row.category === id))
                .map(({ id, name }) => <label className={finance.check} key={id}><input type="checkbox" checked={funding.categories.includes(id)} onChange={(event) => {
                  const checked = event.target.checked;
                  edit((current) => ({ ...current, fundraising: { ...current.fundraising,
                    categories: checked ? [...current.fundraising.categories, id] : current.fundraising.categories.filter((category) => category !== id) } }));
                }} /> {name}</label>)}
              <label className={finance.check}><input type="checkbox" checked={funding.allowOverGoal} onChange={(event) => {
                const allowOverGoal = event.target.checked;
                edit((current) => ({ ...current, fundraising: { ...current.fundraising, allowOverGoal } }));
              }} /> Cho phép vượt mục tiêu</label>
            </fieldset>
          </div>}
        </section>}
        {tab === "receiving" && <BudgetReceivingFields receiving={plan.receiving} campaignId={campaign.id}
          revision={view.version} onChange={(receiving) => edit((current) => ({ ...current, receiving }))}
          onUpload={(file) => void uploadQr(file)} />}
        {tab === "overview" && <CampaignBudgetSummary campaignId={campaign.id} view={view} plan={plan} totals={totals} />}
        {tab === "actuals" && <>
          {!view.confirmedAt && <p className={finance.empty}>Hãy xác nhận ngân sách trước khi ghi chi thực tế.</p>}
          {view.confirmedAt && plan.expenses.length === 0 && <p className={finance.empty}>Chưa có khoản chi.</p>}
          {view.confirmedAt && plan !== view.plan && <p className="notice">Lưu thay đổi của dự toán trước khi ghi chi thực tế.</p>}
          {view.confirmedAt && plan.expenses.map((expense) => <ActualExpenseForm key={`${expense.id}:${expense.actualAmount}`}
            expense={expense} disabled={!view.canRecordActuals || plan !== view.plan} onSave={(amount) => void saveActual(expense.id, amount)} />)}
        </>}
        {tab === "donations" && view.canRecordActuals && <CampaignDonationsTab campaignId={campaign.id} />}
        {view.canEdit && tab !== "actuals" && <div className={finance.saveBar}>
          <span role="status">{plan !== (view.plan ?? emptyBudget) ? "Có thay đổi chưa lưu" : "Mọi thay đổi đã được lưu"}</span>
          <button type="button" className="secondary" onClick={() => void save(false)}>Lưu bản nháp ngân sách</button>
          <button type="button" onClick={() => void save(true)}>Gửi xác nhận ngân sách</button>
        </div>}
      </fieldset>
    </>}
  </section>;
}
