using System.ComponentModel.DataAnnotations;

namespace CampaignService.Contracts;

public sealed record BudgetExpense(Guid Id, string Name, string Category, int Quantity, string Unit, int Days,
    decimal UnitPrice, Guid? ActivityId, string Notes, [MaxLength(2000)] string? PriceBasis = null, decimal? ActualAmount = null);
public sealed record SaveActualExpenseRequest([Required] string Version, decimal? ActualAmount);
public sealed record BudgetFunding(Guid Id, string Name, decimal Amount, bool Confirmed, string Notes);
public sealed record BudgetFundraising(DateOnly? OpensOn, DateOnly? ClosesOn, string Purpose, string[] Categories,
    bool AllowOverGoal, string ShortfallPolicy, string PublicExplanation);
public sealed record BudgetPlan(BudgetExpense[] Expenses, BudgetFunding[] Funding, decimal MinimumAmount,
    string Rationale, string? EventScope, BudgetFundraising Fundraising, BudgetReceiving? Receiving = null);
public sealed record BudgetReceiving(BudgetBank? Bank, BudgetGoods? Goods);
public sealed record BudgetBank([MaxLength(120)] string BankName, [MaxLength(150)] string AccountHolder,
    [MaxLength(40)] string AccountNumber, Guid? QrMediaId, [MaxLength(300)] string TransferNote);
public sealed record BudgetGoods([MaxLength(1000)] string AcceptedItems, [MaxLength(400)] string Address,
    [MaxLength(200)] string ReceivingHours, [MaxLength(160)] string Contact);
public sealed record SaveBudgetRequest([Required] string Version, [Required] BudgetPlan Plan, bool Confirm);
public sealed record BudgetCategory(string Id, string Name);
public sealed record BudgetActivity(Guid Id, string Title, DateOnly? Date, int StaffNeeded, int VolunteersNeeded);
public sealed record BudgetTotals(decimal Estimated, decimal ConfirmedFunding, decimal ExpectedFunding, decimal FundraisingGoal);
public sealed record BudgetView(string Version, BudgetPlan? Plan, BudgetTotals? Totals, DateTimeOffset? ConfirmedAt,
    string? ConfirmedByName, bool NeedsReview, bool CanEdit, BudgetCategory[] Categories, BudgetActivity[] Activities, bool OperationsConfirmed,
    bool CanRecordActuals);
