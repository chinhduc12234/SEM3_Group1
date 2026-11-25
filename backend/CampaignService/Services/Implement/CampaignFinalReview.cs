using System.Text.Json;
using CampaignService.Contracts;
using CampaignService.Data;
using Shared;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    private const string FinalPending = "PENDING_FINAL_REVIEW";
    private const string FinalApproved = "FINAL_APPROVED";
    private const string FinalRejected = "FINAL_REJECTED";
    private const string FinalSubmitAction = "FINAL_SUBMIT";
    private sealed record FinalSnapshot(CampaignConcept Concept, OperationsPlan Operations, BudgetPlan Budget, JsonElement Dossier,
        string ContactEmail, string ContactPhone, CampaignAssignmentView[] Assignments);

    private static CampaignReview? FinalSubmission(Campaign campaign) => campaign.Reviews
        .Where(review => review.Action == FinalSubmitAction).OrderByDescending(review => review.CreatedAt).FirstOrDefault();

    private static bool IsModernPublication(Campaign campaign) => campaign.Status == "PUBLISHED" && FinalSubmission(campaign) is not null;

    public async Task<CampaignView> SubmitFinal(Guid id, VersionRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        if (!HasAssignment(campaign, actor, permission, "CAMPAIGN_MANAGER"))
            throw new ApiException(403, "Chỉ quản lý chiến dịch được phân công có thể gửi duyệt cuối.");
        Match(campaign, request.Version);
        EnsurePlanning(campaign);
        var concept = ReadConcept(campaign);
        var budget = ReadBudgetPlan(campaign);
        if (concept is null || budget is null || campaign.OperationsConfirmedAt is null ||
            campaign.BudgetConfirmedAt is null || campaign.BudgetNeedsReview)
            throw new ApiException(409, "Cần xác nhận kế hoạch vận hành và ngân sách hiện tại trước khi gửi duyệt cuối.");
        var members = (await access.Members(campaign.OrganizationId, ct)).ToDictionary(member => member.UserId);
        if (AssignmentRoles.Any(role => !campaign.Assignments.Any(assignment =>
            assignment.Role == role && assignment.IsPrimary && assignment.RevokedAt is null &&
            members.TryGetValue(assignment.UserId, out var member) &&
            member.MembershipId == assignment.MembershipId && member.Roles.Contains(role))))
            throw new ApiException(409, "Cần đủ người phụ trách chính đang hoạt động cho cả ba vai trò.");
        var operations = ReadOperationsPlan(campaign);
        using var dossier = JsonDocument.Parse(CaptureConcept(campaign));
        var assignments = campaign.Assignments.Where(assignment => assignment.RevokedAt is null).Select(assignment =>
            new CampaignAssignmentView(assignment.UserId, assignment.FullName, assignment.Role, assignment.IsPrimary)).ToArray();
        var snapshot = JsonSerializer.Serialize(new FinalSnapshot(concept, operations, budget, dossier.RootElement,
            campaign.ContactEmail, campaign.ContactPhone, assignments), SnapshotJson);
        campaign.Status = FinalPending;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(campaign, actor, FinalSubmitAction, snapshot: snapshot);
        await repository.Save(ct);
        return View(campaign);
    }

    public async Task<CampaignView> ReviewFinal(Guid id, FinalReviewRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        await access.Require(campaign.OrganizationId, actor, ["OWNER"], ct);
        Match(campaign, request.Version);
        var submission = FinalSubmission(campaign);
        if (campaign.Status != FinalPending || submission is null || submission.Id != request.SubmissionId)
            throw new ApiException(409, "Phiên bản kế hoạch đang chờ duyệt đã thay đổi.");
        if (submission.ActorId == actor)
            throw new ApiException(403, "Người gửi duyệt cuối không thể tự xét duyệt.");
        var note = request.Note?.Trim() ?? "";
        var approved = request.Decision == "APPROVE";
        var rejected = request.Decision == "REJECT";
        if (!approved && note.Length == 0)
            throw new ApiException(400, "Ghi lý do khi trả sửa hoặc từ chối kế hoạch.");
        if (!approved && !rejected)
        {
            if (request.RevisionArea is null)
                throw new ApiException(400, "Chọn phần cần sửa.");
            if (request.RevisionArea is "OPERATIONS" or "BOTH")
            {
                campaign.OperationsConfirmedAt = null;
                campaign.OperationsConfirmedBy = null;
            }
            if (request.RevisionArea is "BUDGET" or "BOTH")
            {
                campaign.BudgetConfirmedAt = null;
                campaign.BudgetNeedsReview = true;
            }
        }
        campaign.Status = approved ? FinalApproved : rejected ? FinalRejected : "PLANNING";
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(campaign, actor, approved ? "FINAL_APPROVE" : rejected ? "FINAL_REJECT" : $"FINAL_RETURN_{request.RevisionArea}",
            note, submission.Id.ToString());
        await repository.Save(ct);
        return View(campaign);
    }

    public async Task<CampaignView> Publish(Guid id, VersionRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        await access.Require(campaign.OrganizationId, actor, ["OWNER"], ct);
        Match(campaign, request.Version);
        var submission = FinalSubmission(campaign);
        if (campaign.Status != FinalApproved || submission?.SubmittedSnapshot is null)
            throw new ApiException(409, "Cần duyệt kế hoạch cuối trước khi công bố.");
        var snapshot = JsonSerializer.Deserialize<FinalSnapshot>(submission.SubmittedSnapshot, SnapshotJson)!;
        campaign.GoalAmount = Totals(snapshot.Budget).FundraisingGoal;
        campaign.Status = "PUBLISHED";
        campaign.PublishedAt = campaign.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(campaign, actor, "PUBLISH", snapshot: submission.Id.ToString());
        await repository.Save(ct);
        return View(campaign);
    }

    private static PublicCampaignPlan? ReadPublicPlan(Campaign campaign)
    {
        var payload = FinalSubmission(campaign)?.SubmittedSnapshot;
        if (campaign.Status != "PUBLISHED" || payload is null) return null;
        var snapshot = JsonSerializer.Deserialize<FinalSnapshot>(payload, SnapshotJson)!;
        var concept = snapshot.Concept;
        var online = concept.EventFormat == "ONLINE";
        var categories = snapshot.Budget.Fundraising.Categories.ToHashSet(StringComparer.Ordinal);
        var acceptedGoods = snapshot.Budget.Receiving?.Goods?.AcceptedItems ?? "";
        var acceptedParts = acceptedGoods.Split([',', ';', '\n', '、', '·'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .SelectMany(part => part.Split([" và ", " and "], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .ToArray();
        var goods = snapshot.Budget.Receiving?.Goods;
        var explicitGoods = goods?.BudgetItemIds?.ToHashSet();
        bool AcceptsInKind(BudgetExpense expense) => explicitGoods?.Contains(expense.Id) ?? acceptedParts.Any(part => part.Length >= 3 &&
            (expense.Name.Contains(part, StringComparison.OrdinalIgnoreCase) || part.Contains(expense.Name, StringComparison.OrdinalIgnoreCase)));
        var targets = snapshot.Budget.Expenses.Select(expense => new PublicFundingTarget(expense.Id, expense.Name, expense.Category,
            expense.Quantity * (decimal)expense.Days * expense.UnitPrice, expense.Quantity * (decimal)expense.Days,
            expense.Unit, AcceptsInKind(expense))).ToArray();
        var financialTargets = targets.Where(target => categories.Contains(target.Category)).ToArray();
        var inKindTargets = targets.Where(target => target.AcceptsInKind && target.Quantity > 0).ToArray();
        var days = snapshot.Operations.Days.OrderBy(day => day.Date).Select(day =>
        {
            var address = online ? null : day.Address ?? (day.Location == campaign.Location ? concept.PlannedAddress : null);
            return new PublicCampaignDay(day.Id, day.Date, day.Title, day.Objective, online ? "Trực tuyến" : day.Location,
                address?.Province?.Name, address?.District?.Name, address?.Ward?.Name, online ? null : day.MapPin,
                day.Activities.OrderBy(activity => activity.Start).Select(activity =>
                    new PublicCampaignActivity(activity.Title, activity.Start, activity.End, online ? "Trực tuyến" : activity.Location)).ToArray());
        }).ToArray();
        var receiving = snapshot.Budget.Receiving;
        if (receiving?.Goods is { } publicGoods) receiving = receiving with { Goods = publicGoods with { ReceiverUserIds = null } };
        return new(concept.ShortDescription, concept.PrimaryGoal, concept.ExpectedOutcomes,
            concept.EventFormat, snapshot.Budget.Fundraising.PublicExplanation, days, receiving,
            financialTargets, inKindTargets);
    }

    public async Task<CampaignDonationContext> DonationContext(Guid id, bool includeRecipients, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        if (campaign.Status != "PUBLISHED") throw new ApiException(404, "Chiến dịch chưa mở nhận quyên góp.");
        var plan = ReadPublicPlan(campaign) ?? throw new ApiException(409, "Chiến dịch chưa có kế hoạch gây quỹ công khai.");
        var snapshot = JsonSerializer.Deserialize<FinalSnapshot>(FinalSubmission(campaign)!.SubmittedSnapshot!, SnapshotJson)!;
        var goods = snapshot.Budget.Receiving?.Goods;
        Guid[] managerUsers = [], receivers = [];
        if (includeRecipients)
        {
            var members = (await access.Members(campaign.OrganizationId, ct)).ToDictionary(member => member.UserId);
            managerUsers = campaign.Assignments.Where(assignment =>
                (assignment.Role is "FINANCE_MANAGER" or "CAMPAIGN_MANAGER") && assignment.RevokedAt is null &&
                members.TryGetValue(assignment.UserId, out var member) && member.MembershipId == assignment.MembershipId &&
                member.Roles.Contains(assignment.Role)).Select(assignment => assignment.UserId).Distinct().ToArray();
            receivers = (goods?.ReceiverUserIds ?? []).Where(members.ContainsKey).Distinct().ToArray();
        }
        var point = goods is null ? null : new DonationReceivingPoint(campaign.Id, goods.Address, goods.ReceivingHours,
            goods.Contact, goods.OpensAt, goods.ClosesAt, goods.AppointmentsPerHour, receivers);
        return new(campaign.Id, campaign.OrganizationId, campaign.Title, plan.FundingTargets ?? [], plan.InKindTargets ?? [],
            managerUsers, snapshot.Budget.Fundraising.OpensOn, snapshot.Budget.Fundraising.ClosesOn, snapshot.Concept.Timezone, point);
    }
}
