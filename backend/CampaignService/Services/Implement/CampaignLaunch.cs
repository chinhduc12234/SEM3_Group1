using System.Text.Json;
using CampaignService.Data;
using Shared;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    public async Task<LaunchContext> LaunchContext(Guid id, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        return await BuildLaunchContext(campaign, actor, permission, ct);
    }

    public async Task ConfirmLaunch(Guid id, LaunchConfirmCommand request, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, request.UserId, ct);
        var context = await BuildLaunchContext(campaign, request.UserId, permission, ct);
        if (!context.AllowedConfirmations.Contains(request.Section))
            throw new ApiException(403, "Bạn chưa được phân công xác nhận phần này.");
        Match(campaign, request.Version);
        if (context.SubmissionId != request.SubmissionId || campaign.StartedAt.HasValue || request.Stamp.Length != 64)
            throw new ApiException(409, "Bản công bố đã thay đổi hoặc chương trình đã bắt đầu.");
        var current = context.Confirmations.FirstOrDefault(item => item.Section == request.Section);
        if (current?.Stamp == request.Stamp && current.UserId == request.UserId) return;
        var confirmation = new LaunchConfirmation(request.Section, request.UserId, request.Stamp, DateTimeOffset.UtcNow);
        campaign.LaunchConfirmations = JsonSerializer.Serialize(context.Confirmations.Where(item => item.Section != request.Section)
            .Append(confirmation).ToArray(), SnapshotJson);
        campaign.UpdatedAt = confirmation.ConfirmedAt;
        Audit(campaign, request.UserId, "LAUNCH_" + request.Section, snapshot: JsonSerializer.Serialize(confirmation, SnapshotJson));
        await repository.Save(ct);
    }

    public async Task<CampaignStarted> StartLaunch(Guid id, LaunchStartCommand request, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, request.UserId, ct);
        var context = await BuildLaunchContext(campaign, request.UserId, permission, ct);
        if (!context.CanStart) throw new ApiException(403, "Bạn chưa được phân công bắt đầu chương trình.");
        if (context.Started is not null) return context.Started;
        Match(campaign, request.Version);
        if (context.SubmissionId != request.SubmissionId || !context.HasActiveLeads || !context.HasLocation || context.HasPendingChange ||
            context.FirstDay is null || context.LastDay is null || context.VerifiedFunds < context.MinimumFunds ||
            context.HasGoodsIntake && !context.HasGoodsReceiver ||
            !context.Confirmations.Any(x => x.Section == "OPERATIONS" && x.Stamp == request.OperationsStamp) ||
            !context.Confirmations.Any(x => x.Section == "FINANCE" && x.Stamp == request.FinanceStamp))
            throw new ApiException(409, "Điều kiện bắt đầu hoặc xác nhận bộ phận đã thay đổi.");

        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow,
            TimeZoneInfo.FindSystemTimeZoneById(context.Timezone)).DateTime);
        if (today < context.FirstDay || today > context.LastDay)
            throw new ApiException(409, "Chương trình chỉ được bắt đầu trong khoảng ngày đã duyệt.");

        var now = DateTimeOffset.UtcNow;
        campaign.StartedAt = now;
        campaign.StartedBy = request.UserId;
        campaign.StartedSubmissionId = request.SubmissionId;
        campaign.UpdatedAt = now;
        Audit(campaign, request.UserId, "LAUNCH_STARTED", snapshot: request.Evidence);
        foreach (var recipient in campaign.Assignments.Where(item => item.RevokedAt == null && item.UserId != request.UserId)
                     .GroupBy(item => item.UserId))
        {
            var eventId = Guid.NewGuid();
            var notification = new CampaignAssignmentEvent(eventId, campaign.OrganizationId, campaign.Id, recipient.Key,
                campaign.Title, recipient.Select(item => item.Role).Distinct().ToArray(), CampaignStarted: true);
            db.AssignmentNotifications.Add(new CampaignNotification { Id = eventId,
                Payload = JsonSerializer.Serialize(notification, SnapshotJson), NextAttemptAt = now });
        }
        try { await repository.Save(ct); }
        catch (ApiException ex) when (ex.Status == 409)
        {
            db.ChangeTracker.Clear();
            var latest = await Get(id, ct);
            if (Started(latest) is { } started) return started;
            throw;
        }
        return Started(campaign)!;
    }

    private async Task<LaunchContext> BuildLaunchContext(Campaign campaign, Guid actor, OrganizationPermission permission, CancellationToken ct)
    {
        var submission = FinalSubmission(campaign);
        var published = campaign.Status == "PUBLISHED" && submission?.SubmittedSnapshot is not null;
        var leadIds = new Dictionary<string, Guid>(StringComparer.Ordinal);
        var sections = Array.Empty<string>();
        var members = published ? (await access.Members(campaign.OrganizationId, ct)).ToDictionary(item => item.UserId) : null;
        if (published)
        {
            foreach (var role in AssignmentRoles)
            {
                var assignment = campaign.Assignments.FirstOrDefault(item => item.Role == role && item.IsPrimary &&
                    item.RevokedAt == null && members!.TryGetValue(item.UserId, out var member) &&
                    member.MembershipId == item.MembershipId && member.Roles.Contains(role));
                if (assignment is not null) leadIds.Add(role, assignment.UserId);
            }
            sections = new[] { ("VOLUNTEER_COORDINATOR", "OPERATIONS"), ("FINANCE_MANAGER", "FINANCE") }
                .Where(item => HasAssignment(campaign, actor, permission, item.Item1)).Select(item => item.Item2).ToArray();
        }
        var snapshot = published ? JsonSerializer.Deserialize<FinalSnapshot>(submission!.SubmittedSnapshot!, SnapshotJson) : null;
        var days = snapshot?.Operations.Days.Where(day => day.Date.HasValue).OrderBy(day => day.Date).ToArray() ?? [];
        var confirmations = campaign.LaunchConfirmations is null ? [] :
            JsonSerializer.Deserialize<LaunchConfirmation[]>(campaign.LaunchConfirmations, SnapshotJson) ?? [];
        if (confirmations.Length > 0 && published)
        {
            confirmations = confirmations.Where(confirmation =>
            {
                var role = confirmation.Section == "OPERATIONS" ? "VOLUNTEER_COORDINATOR" : "FINANCE_MANAGER";
                return campaign.Assignments.Any(assignment => assignment.UserId == confirmation.UserId &&
                    assignment.Role == role && assignment.RevokedAt == null &&
                    members!.TryGetValue(assignment.UserId, out var member) &&
                    assignment.MembershipId == member.MembershipId && member.Roles.Contains(role));
            }).ToArray();
        }
        var goods = snapshot?.Budget.Receiving?.Goods;
        var hasReceiver = goods is null || leadIds.ContainsKey("FINANCE_MANAGER");
        return new(campaign.Id, campaign.OrganizationId, campaign.Title, campaign.Status, Convert.ToBase64String(campaign.Version),
            published ? submission!.Id : null, days.FirstOrDefault()?.Date, days.LastOrDefault()?.Date,
            snapshot?.Concept.Timezone ?? "Asia/Ho_Chi_Minh", days.Length > 0 && (snapshot!.Concept.EventFormat == "ONLINE" ||
                days.All(day => !string.IsNullOrWhiteSpace(day.Location)) || !string.IsNullOrWhiteSpace(campaign.Location)),
            leadIds.Count == AssignmentRoles.Length, published && PendingScheduleChange(campaign) is not null,
            (snapshot?.Operations.VolunteerGroups ?? []).Where(group => group.VolunteerCount > 0)
                .Select(group => new LaunchGroup(group.Id, group.Name, group.MinimumConfirmed ?? (group.IsPriority ? group.VolunteerCount : 0))).ToArray(),
            snapshot?.Budget.MinimumAmount ?? 0, snapshot?.Budget.Funding.Where(item => item.Confirmed).Sum(item => item.Amount) ?? 0,
            goods is not null, hasReceiver, sections,
            permission.Roles.Contains("OWNER") || HasAssignment(campaign, actor, permission, "CAMPAIGN_MANAGER"),
            confirmations, Started(campaign));
    }

    private static CampaignStarted? Started(Campaign campaign) =>
        campaign.StartedAt is { } at && campaign.StartedBy is { } actor && campaign.StartedSubmissionId is { } submission
            ? new(campaign.Id, submission, actor, at) : null;

}
