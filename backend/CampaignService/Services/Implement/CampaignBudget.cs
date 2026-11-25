using System.Text.Json;
using CampaignService.Contracts;
using CampaignService.Data;
using Shared;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    private const string FinanceRole = "FINANCE_MANAGER";
    private const string ReceivingQrKind = "FUNDRAISING_QR";
    private const decimal MaxBudgetAmount = 1_000_000_000_000_000m;
    private static readonly BudgetCategory[] DefaultBudgetCategories =
    [
        new("TRANSPORT", "Di chuyển"), new("MEALS", "Ăn uống"), new("LODGING", "Lưu trú"),
        new("VENUE", "Địa điểm"), new("EQUIPMENT", "Thiết bị"), new("SUPPLIES", "Vật tư"),
        new("COMMUNICATIONS", "Truyền thông"), new("PERSONNEL", "Nhân sự"),
        new("CONTINGENCY", "Dự phòng"), new("OTHER", "Khác")
    ];

    private BudgetCategory[] BudgetCategories() => DefaultBudgetCategories.Select(category =>
    {
        var name = configuration[$"Budget:CategoryNames:{category.Id}"]?.Trim();
        return string.IsNullOrEmpty(name) ? category : category with { Name = name };
    }).ToArray();

    public async Task<BudgetView> Budget(Guid id, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        var assigned = HasAssignment(campaign, actor, permission, FinanceRole);
        return BudgetResult(campaign, campaign.Status == "PLANNING" && assigned,
            assigned && IsModernPublication(campaign));
    }

    public async Task<BudgetReceiverCandidate[]> BudgetReceivers(Guid id, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        if (!HasAssignment(campaign, actor, permission, FinanceRole))
            throw new ApiException(403, "Bạn chưa được phân công cấu hình điểm nhận.");
        EnsurePlanning(campaign);
        return (await access.Members(campaign.OrganizationId, ct)).OrderBy(member => member.FullName)
            .Select(member => new BudgetReceiverCandidate(member.UserId, member.FullName)).ToArray();
    }

    public async Task<BudgetView> SaveBudget(Guid id, SaveBudgetRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        if (!HasAssignment(campaign, actor, permission, FinanceRole))
            throw new ApiException(403, "Chỉ người được phân công ngân sách có thể sửa dự toán.");
        EnsurePlanning(campaign);
        Match(campaign, request.Version);
        var plan = request.Plan with { Receiving = NormalizeReceiving(request.Plan.Receiving) };
        var activities = BudgetActivities(ReadOperationsPlan(campaign));
        ValidateBudget(plan, activities, campaign, request.Confirm);
        if (request.Confirm && plan.Receiving?.Goods?.ReceiverUserIds is { Length: > 0 } receiverIds)
        {
            var members = (await access.Members(campaign.OrganizationId, ct)).Select(member => member.UserId).ToHashSet();
            if (receiverIds.Any(id => !members.Contains(id))) throw new ApiException(400, "Người tiếp nhận phải là thành viên đang hoạt động.");
        }
        var actuals = ReadBudgetPlan(campaign)?.Expenses.Where(expense => expense.ActualAmount.HasValue)
            .ToDictionary(expense => expense.Id, expense => expense.ActualAmount) ?? [];
        if (actuals.Keys.Except(plan.Expenses.Select(expense => expense.Id)).Any())
            throw new ApiException(400, "Khoản đã ghi chi thực tế cần được giữ trong dự toán.");
        plan = plan with { Expenses = plan.Expenses.Select(expense => expense with
        {
            ActualAmount = actuals.GetValueOrDefault(expense.Id)
        }).ToArray() };
        var payload = JsonSerializer.Serialize(plan, SnapshotJson);
        if (payload.Length > 500_000)
            throw new ApiException(400, "Dự toán vượt giới hạn dung lượng.");
        var name = request.Confirm
            ? (await access.Members(campaign.OrganizationId, ct)).FirstOrDefault(member => member.UserId == actor)?.FullName ?? ""
            : "";
        campaign.BudgetPlan = payload;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        campaign.BudgetConfirmedAt = request.Confirm ? campaign.UpdatedAt : null;
        if (request.Confirm) campaign.BudgetNeedsReview = false;
        Audit(campaign, actor, request.Confirm ? "CONFIRM_BUDGET" : "SAVE_BUDGET", name, request.Confirm ? payload : null);
        await repository.Save(ct);
        return BudgetResult(campaign, true);
    }

    public async Task<BudgetView> SaveActualExpense(Guid id, Guid expenseId, SaveActualExpenseRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        if (!HasAssignment(campaign, actor, permission, FinanceRole))
            throw new ApiException(403, "Chỉ người được phân công ngân sách có thể ghi chi thực tế.");
        var published = IsModernPublication(campaign);
        if (!published) EnsurePlanning(campaign);
        Match(campaign, request.Version);
        if (campaign.BudgetConfirmedAt is null)
            throw new ApiException(409, "Hãy xác nhận ngân sách trước khi ghi chi thực tế.");
        var plan = ReadBudgetPlan(campaign)!;
        if (!plan.Expenses.Any(expense => expense.Id == expenseId))
            throw new ApiException(404, "Không tìm thấy khoản chi.");
        if (request.ActualAmount is decimal amount && !ValidCurrency(amount))
            throw new ApiException(400, "Chi thực tế phải là số tiền VND hợp lệ.");
        plan = plan with { Expenses = plan.Expenses.Select(expense => expense.Id == expenseId
            ? expense with { ActualAmount = request.ActualAmount } : expense).ToArray() };
        campaign.BudgetPlan = JsonSerializer.Serialize(plan, SnapshotJson);
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(campaign, actor, "UPDATE_ACTUAL_EXPENSE", expenseId.ToString(), JsonSerializer.Serialize(request.ActualAmount, SnapshotJson));
        await repository.Save(ct);
        return BudgetResult(campaign, !published, published);
    }

    private static BudgetPlan? ReadBudgetPlan(Campaign campaign) => campaign.BudgetPlan is { } payload
        ? JsonSerializer.Deserialize<BudgetPlan>(payload, SnapshotJson) : null;

    private static BudgetReceiving? NormalizeReceiving(BudgetReceiving? receiving)
    {
        var bank = receiving?.Bank;
        var goods = receiving?.Goods;
        if (bank is null && goods is null) return null;
        return new BudgetReceiving(bank is null ? null : bank with
        {
            BankName = bank.BankName?.Trim() ?? "", AccountHolder = bank.AccountHolder?.Trim() ?? "",
            AccountNumber = bank.AccountNumber?.Trim() ?? "", TransferNote = bank.TransferNote?.Trim() ?? ""
        }, goods is null ? null : goods with
        {
            AcceptedItems = goods.AcceptedItems?.Trim() ?? "", Address = goods.Address?.Trim() ?? "",
            ReceivingHours = goods.ReceivingHours?.Trim() ?? "", Contact = goods.Contact?.Trim() ?? ""
        });
    }

    private BudgetView BudgetResult(Campaign campaign, bool canEdit, bool recordAfterPublication = false)
    {
        var confirmed = campaign.BudgetConfirmedAt;
        var plan = canEdit || confirmed is not null ? ReadBudgetPlan(campaign) : null;
        var confirmer = confirmed is null ? null : campaign.Reviews
            .Where(review => review.Action == "CONFIRM_BUDGET")
            .OrderByDescending(review => review.CreatedAt).FirstOrDefault()?.Note;
        var activities = canEdit || confirmed is not null ? BudgetActivities(ReadOperationsPlan(campaign)) : [];
        return new(Convert.ToBase64String(campaign.Version), plan, plan is null ? null : Totals(plan), confirmed,
            confirmer, campaign.BudgetNeedsReview, canEdit, BudgetCategories(), activities, campaign.OperationsConfirmedAt is not null,
            confirmed is not null && (canEdit || recordAfterPublication));
    }

    private static BudgetActivity[] BudgetActivities(OperationsPlan plan) => plan.Days.SelectMany(day =>
        day.Activities.Select(activity => new BudgetActivity(activity.Id, activity.Title, day.Date,
            activity.StaffNeeded, activity.VolunteersNeeded))).ToArray();

    private static BudgetTotals Totals(BudgetPlan plan)
    {
        var estimated = plan.Expenses.Sum(row => row.Quantity * (decimal)row.Days * row.UnitPrice);
        var confirmed = plan.Funding.Where(row => row.Confirmed).Sum(row => row.Amount);
        var expected = plan.Funding.Where(row => !row.Confirmed).Sum(row => row.Amount);
        return new(estimated, confirmed, expected, Math.Max(estimated - confirmed, 0));
    }

    private static bool ValidCurrency(decimal amount) => amount >= 0 && amount <= MaxBudgetAmount && decimal.Truncate(amount) == amount;

    private static void ValidateBudget(BudgetPlan plan, BudgetActivity[] activities, Campaign campaign, bool confirm)
    {
        if (plan.Expenses is null || plan.Funding is null || plan.Fundraising?.Categories is null ||
            plan.Expenses.Length > 200 || plan.Funding.Length > 100 || plan.Fundraising.Categories.Length > DefaultBudgetCategories.Length)
            throw new ApiException(400, "Dữ liệu dự toán hoặc số lượng khoản chi và nguồn vốn không hợp lệ.");
        var categories = DefaultBudgetCategories.Select(category => category.Id).ToHashSet();
        if (plan.Expenses.Any(row => row is null || row.Id == Guid.Empty ||
            !categories.Contains(row.Category) || row.Quantity is < 1 or > 100000 || row.Days is < 1 or > 366 ||
            !ValidCurrency(row.UnitPrice) || row.Name?.Length > 200 || row.Unit?.Length > 40 || row.Notes?.Length > 2000) ||
            plan.Funding.Any(row => row is null || row.Id == Guid.Empty || !ValidCurrency(row.Amount) ||
                row.Name?.Length > 200 || row.Notes?.Length > 2000))
            throw new ApiException(400, "Kiểm tra danh mục, số lượng, số ngày, đơn giá VND và độ dài nội dung.");
        if (plan.Expenses.Select(row => row.Id).Distinct().Count() != plan.Expenses.Length ||
            plan.Funding.Select(row => row.Id).Distinct().Count() != plan.Funding.Length ||
            plan.Expenses.Where(row => !string.IsNullOrWhiteSpace(row.Name))
                .GroupBy(row => (row.Name.Trim().ToUpperInvariant(), row.Category, row.ActivityId)).Any(group => group.Count() > 1))
            throw new ApiException(400, "Dự toán có khoản chi trùng tên, nhóm và hoạt động hoặc mã dòng bị trùng.");
        var totals = Totals(plan);
        if (totals.Estimated > MaxBudgetAmount || totals.ConfirmedFunding + totals.ExpectedFunding > MaxBudgetAmount ||
            !ValidCurrency(plan.MinimumAmount) || plan.Rationale?.Length > 2000)
            throw new ApiException(400, "Tổng dự toán, nguồn vốn, ngưỡng tối thiểu hoặc giải trình không hợp lệ.");
        var fundraising = plan.Fundraising;
        if (fundraising.OpensOn == DateOnly.MinValue || fundraising.ClosesOn == DateOnly.MinValue ||
            fundraising.ClosesOn < fundraising.OpensOn || fundraising.Categories.Any(category => !categories.Contains(category)) ||
            fundraising.Categories.Distinct().Count() != fundraising.Categories.Length ||
            fundraising.Purpose?.Length > 2000 || fundraising.ShortfallPolicy?.Length > 2000 || fundraising.PublicExplanation?.Length > 2000)
            throw new ApiException(400, "Khoảng thời gian hoặc nội dung gây quỹ không hợp lệ.");
        if (plan.EventScope is not (null or "INDEPENDENT" or "PARENT_ALLOCATION") ||
            (campaign.ParentCampaignId is null && plan.EventScope is not null))
            throw new ApiException(400, "Phạm vi ngân sách sự kiện không hợp lệ.");
        if (plan.Receiving?.Bank?.QrMediaId is Guid qrId &&
            !campaign.Media.Any(media => media.Id == qrId && media.Kind == ReceivingQrKind))
            throw new ApiException(400, "Chọn mã QR đã tải cho ngân sách của hồ sơ này.");
        if (plan.Receiving?.Goods is { } point &&
            (point.OpensAt.HasValue != point.ClosesAt.HasValue || point.OpensAt >= point.ClosesAt ||
             point.ReceiverUserIds?.Any(id => id == Guid.Empty) == true ||
             point.BudgetItemIds?.Any(id => !plan.Expenses.Any(expense => expense.Id == id)) == true))
            throw new ApiException(400, "Chọn hạng mục, người tiếp nhận và khung giờ nhận hiện vật hợp lệ.");
        if (!confirm) return;
        if ((plan.Receiving?.Bank is { } bank && (string.IsNullOrWhiteSpace(bank.BankName) ||
            string.IsNullOrWhiteSpace(bank.AccountHolder) || string.IsNullOrWhiteSpace(bank.AccountNumber))) ||
            (plan.Receiving?.Goods is { } goods && (string.IsNullOrWhiteSpace(goods.AcceptedItems) ||
                string.IsNullOrWhiteSpace(goods.Address) || string.IsNullOrWhiteSpace(goods.Contact))))
            throw new ApiException(400, "Điền đầy đủ tài khoản ngân hàng hoặc thông tin điểm nhận hiện vật đã chọn.");
        if (string.IsNullOrWhiteSpace(plan.Rationale) || plan.MinimumAmount > totals.Estimated ||
            (campaign.ParentCampaignId is not null && plan.EventScope is null) ||
            plan.Expenses.Any(row => string.IsNullOrWhiteSpace(row.Name) || string.IsNullOrWhiteSpace(row.Unit) || row.UnitPrice == 0) ||
            plan.Funding.Any(row => string.IsNullOrWhiteSpace(row.Name) || row.Amount == 0))
            throw new ApiException(400, "Hoàn thiện khoản chi, nguồn vốn, phạm vi và giải trình. Ngưỡng tối thiểu không được vượt tổng dự toán.");
        var activityIds = activities.Select(activity => activity.Id).ToHashSet();
        if (plan.Expenses.Any(row => row.ActivityId is Guid id && !activityIds.Contains(id)))
            throw new ApiException(400, "Có khoản chi gắn với hoạt động đã thay đổi. Hãy chọn lại hoạt động.");
        if (plan.Expenses.Any(row => row.ActivityId.HasValue) && campaign.OperationsConfirmedAt is null)
            throw new ApiException(400, "Cần xác nhận kế hoạch vận hành trước khi xác nhận các khoản chi gắn với hoạt động.");
        if (totals.FundraisingGoal > 0 && (fundraising.OpensOn is null || fundraising.ClosesOn is null ||
            fundraising.Categories.Length == 0 || fundraising.Categories.Any(category => !plan.Expenses.Any(row => row.Category == category)) ||
            string.IsNullOrWhiteSpace(fundraising.Purpose) || string.IsNullOrWhiteSpace(fundraising.ShortfallPolicy) ||
            string.IsNullOrWhiteSpace(fundraising.PublicExplanation)))
            throw new ApiException(400, "Điền thời gian, mục đích, nhóm chi phí, cách xử lý thiếu vốn và nội dung công khai cho kế hoạch gây quỹ.");
    }

    private static string BudgetBasis(OperationsPlan plan) => JsonSerializer.Serialize(new
    {
        Days = plan.Days.OrderBy(day => day.Id).Select(day => new { day.Id, day.Date, day.Location,
            Activities = day.Activities.OrderBy(activity => activity.Id).Select(activity => new
            {
                activity.Id, activity.Title, activity.Start, activity.End, activity.Location, activity.StaffNeeded,
                activity.VolunteersNeeded, Teams = activity.TeamIds.Order()
            }) }),
        Teams = plan.Teams.OrderBy(team => team.Id).Select(team => new { team.Id, team.StaffNeeded, team.VolunteersNeeded }),
        Groups = plan.VolunteerGroups!.OrderBy(group => group.Id)
            .Select(group => new { group.Id, group.VolunteerCount, group.DayId, group.ActivityId, group.TeamId })
    }, SnapshotJson);
}
