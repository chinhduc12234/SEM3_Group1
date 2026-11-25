using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CampaignService.Contracts;
using CampaignService.Data;
using Shared;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    private static readonly VolunteerGroupCategory[] VolunteerGroupCategories =
    [
        new("GENERAL", "Hỗ trợ chung"),
        new("COORDINATION", "Điều phối người tham gia"),
        new("COMMUNITY", "Hỗ trợ người thụ hưởng"),
        new("EVENT_SUPPORT", "Hỗ trợ tổ chức hoạt động"),
        new("SAFETY", "An toàn và sơ cứu"),
        new("COMMUNICATIONS", "Truyền thông")
    ];

    public async Task<OperationsView> Operations(Guid id, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        if (campaign.Status is not ("PLANNING" or FinalPending or FinalApproved or FinalRejected or "PUBLISHED") ||
            (campaign.OperationsPlan is null && campaign.Status == "PUBLISHED"))
            throw new ApiException(409, "Hồ sơ chưa có kế hoạch vận hành.");
        var assigned = HasAssignment(campaign, actor, permission, "VOLUNTEER_COORDINATOR");
        var canEdit = campaign.Status == "PLANNING" && assigned;
        var plan = ReadOperationsPlan(campaign);
        if (campaign.OperationsConfirmedAt is null) plan = AddCalendarDays(campaign, plan);
        return OperationsResult(campaign, plan, canEdit, campaign.Status == "PLANNING" && permission.Roles.Contains("OWNER"),
            await access.Members(campaign.OrganizationId, ct), assigned && IsModernPublication(campaign));
    }

    public async Task<OperationsView> SaveOperations(Guid id, CampaignOperationsRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        if (!HasAssignment(campaign, actor, permission, "VOLUNTEER_COORDINATOR"))
            throw new ApiException(403, "Chỉ người được phân công vận hành có thể sửa kế hoạch.");
        EnsurePlanning(campaign);
        Match(campaign, request.Version);
        var members = await access.Members(campaign.OrganizationId, ct);
        var previousPlan = ReadOperationsPlan(campaign);
        var previousDays = previousPlan.Days.ToDictionary(day => day.Id);
        var attendance = previousPlan.Days.SelectMany(day => day.Activities)
            .Where(activity => activity.Attendance is not null).ToDictionary(activity => activity.Id, activity => activity.Attendance);
        var plan = request.Plan with
        {
            Resources = previousPlan.Resources,
            VolunteerGroups = request.Plan.VolunteerGroups ?? previousPlan.VolunteerGroups
        };
        var operatorIds = campaign.Assignments
            .Where(assignment => assignment.Role == "VOLUNTEER_COORDINATOR" && assignment.RevokedAt is null)
            .Select(assignment => assignment.UserId).ToHashSet();
        ValidateOperations(plan, members, operatorIds);
        if (attendance.Keys.Except(plan.Days.SelectMany(day => day.Activities).Select(activity => activity.Id)).Any())
            throw new ApiException(400, "Hoạt động đã ghi nhận quân số cần được giữ trong hồ sơ.");
        plan = plan with
        {
            Days = plan.Days.Select(day =>
            {
                var reason = day.ExtraReason?.Trim();
                var previous = previousDays.GetValueOrDefault(day.Id);
                return day with
                {
                    Location = day.Address is null ? day.Location : FormatOperationsAddress(day.Address),
                    Activities = day.Activities.Select(activity => activity with
                    {
                        Attendance = attendance.GetValueOrDefault(activity.Id)
                    }).ToArray(),
                    ExtraReason = IsOutsideRange(campaign, day.Date) ? reason : null,
                    ExtraApprovedAt = IsOutsideRange(campaign, day.Date) && previous?.Date == day.Date &&
                        previous?.ExtraReason == reason ? previous?.ExtraApprovedAt : null
                };
            }).ToArray()
        };
        plan = AddCalendarDays(campaign, plan);
        if (plan.Days.Length > OperationsPlan.MaximumDays)
            throw new ApiException(400, $"Kế hoạch có tối đa {OperationsPlan.MaximumDays} ngày.");
        if (plan.Days.Any(day => IsOutsideRange(campaign, day.Date) && string.IsNullOrWhiteSpace(day.ExtraReason)))
            throw new ApiException(400, "Hãy nêu lý do cho ngày nằm ngoài khoảng đã duyệt.");
        if (request.Confirm && plan.Days.Any(day => IsOutsideRange(campaign, day.Date) && day.ExtraApprovedAt is null))
            throw new ApiException(400, "Owner cần duyệt ngày bổ sung trước khi xác nhận kế hoạch vận hành.");
        if (request.Confirm)
        {
            if (ReadConcept(campaign)?.EventFormat != "ONLINE" && plan.Days.Any(day =>
                string.IsNullOrWhiteSpace(day.Location) || (day.Address is { } address &&
                    (address.Province is null || address.Ward is null || string.IsNullOrWhiteSpace(address.Detail)))))
                throw new ApiException(400, "Hãy điền địa chỉ cụ thể cho từng ngày triển khai.");
            ValidateConfirmation(plan);
            ValidateVolunteerCapacity(plan);
        }
        var payload = JsonSerializer.Serialize(plan, SnapshotJson);
        if (payload.Length > 1_000_000) throw new ApiException(400, "Kế hoạch vượt giới hạn dung lượng.");
        if (campaign.BudgetConfirmedAt is not null && BudgetBasis(previousPlan) != BudgetBasis(plan))
        {
            campaign.BudgetConfirmedAt = null;
            campaign.BudgetNeedsReview = true;
            Audit(campaign, actor, "BUDGET_NEEDS_REVIEW");
        }
        campaign.OperationsPlan = payload;
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        campaign.OperationsConfirmedAt = request.Confirm ? campaign.UpdatedAt : null;
        campaign.OperationsConfirmedBy = request.Confirm ? actor : null;
        Audit(campaign, actor, request.Confirm ? "CONFIRM_OPERATIONS" : "SAVE_OPERATIONS",
            note: request.Confirm ? members.FirstOrDefault(member => member.UserId == actor)?.FullName ?? "" : "",
            snapshot: request.Confirm ? payload : null);
        await repository.Save(ct);
        return OperationsResult(campaign, plan, true, permission.Roles.Contains("OWNER"), members);
    }

    public async Task<OperationsView> SaveAttendance(Guid id, Guid activityId, SaveAttendanceRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        if (!HasAssignment(campaign, actor, permission, "VOLUNTEER_COORDINATOR"))
            throw new ApiException(403, "Chỉ người được phân công vận hành có thể cập nhật quân số.");
        var published = IsModernPublication(campaign);
        if (!published) EnsurePlanning(campaign);
        Match(campaign, request.Version);
        if (campaign.OperationsConfirmedAt is null)
            throw new ApiException(409, "Hãy xác nhận kế hoạch vận hành trước khi cập nhật quân số.");
        var plan = ReadOperationsPlan(campaign);
        var day = plan.Days.SingleOrDefault(day => day.Activities.Any(activity => activity.Id == activityId))
            ?? throw new ApiException(404, "Không tìm thấy hoạt động.");
        var counts = request.Attendance;
        if (counts.StaffPresent > counts.StaffConfirmed || counts.VolunteersPresent > counts.VolunteersConfirmed)
            throw new ApiException(400, "Số có mặt không được vượt số đã xác nhận.");
        plan = plan with
        {
            Days = plan.Days.Select(item => item.Id != day.Id ? item : item with
            {
                Activities = item.Activities.Select(activity => activity.Id == activityId
                    ? activity with { Attendance = counts } : activity).ToArray()
            }).ToArray()
        };
        var members = await access.Members(campaign.OrganizationId, ct);
        campaign.OperationsPlan = JsonSerializer.Serialize(plan, SnapshotJson);
        campaign.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(campaign, actor, "UPDATE_ACTIVITY_ATTENDANCE", activityId.ToString(), JsonSerializer.Serialize(counts, SnapshotJson));
        await repository.Save(ct);
        return OperationsResult(campaign, plan, !published, !published && permission.Roles.Contains("OWNER"), members, published);
    }

    public async Task<OperationsView> ApproveOperationsDay(Guid id, Guid dayId, VersionRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await access.Require(campaign.OrganizationId, actor, ["OWNER"], ct);
        EnsurePlanning(campaign);
        Match(campaign, request.Version);
        var plan = ReadOperationsPlan(campaign);
        var day = plan.Days.SingleOrDefault(x => x.Id == dayId)
            ?? throw new ApiException(404, "Không tìm thấy ngày đã lưu.");
        if (!IsOutsideRange(campaign, day.Date) || string.IsNullOrWhiteSpace(day.ExtraReason))
            throw new ApiException(400, "Chỉ duyệt ngày bổ sung ngoài khoảng đã duyệt có lý do.");
        var members = await access.Members(campaign.OrganizationId, ct);
        if (day.ExtraApprovedAt is null)
        {
            campaign.UpdatedAt = DateTimeOffset.UtcNow;
            var approved = day with { ExtraApprovedAt = campaign.UpdatedAt };
            plan = plan with { Days = plan.Days.Select(x => x.Id == dayId ? approved : x).ToArray() };
            campaign.OperationsPlan = JsonSerializer.Serialize(plan, SnapshotJson);
            Audit(campaign, actor, "APPROVE_EXTRA_DAY", note: $"{day.Date:yyyy-MM-dd}: {day.ExtraReason}",
                snapshot: JsonSerializer.Serialize(approved, SnapshotJson));
            await repository.Save(ct);
        }
        return OperationsResult(campaign, AddCalendarDays(campaign, plan),
            HasAssignment(campaign, actor, permission, "VOLUNTEER_COORDINATOR"), true, members);
    }

    private static OperationsView OperationsResult(Campaign c, OperationsPlan plan, bool canEdit, bool canApprove, CampaignMember[] members,
        bool recordAfterPublication = false) =>
        new(Convert.ToBase64String(c.Version), plan, c.OperationsConfirmedAt, canEdit,
            members.Select(m => new OperationsMember(m.UserId, m.FullName, !c.Assignments.Any(assignment =>
                assignment.UserId == m.UserId && assignment.Role == "VOLUNTEER_COORDINATOR" && assignment.RevokedAt is null))).ToArray(),
            canApprove, CalendarLength(c) > 0,
            VolunteerGroupCategories, OperationsConfirmer(c, members), c.OperationsConfirmedAt is not null && (canEdit || recordAfterPublication));

    private static string? OperationsConfirmer(Campaign c, CampaignMember[] members)
    {
        if (c.OperationsConfirmedAt is null || c.OperationsConfirmedBy is not Guid confirmer)
            return null;
        var name = c.Reviews.Where(review => review.Action == "CONFIRM_OPERATIONS" && review.ActorId == confirmer)
            .OrderByDescending(review => review.CreatedAt).FirstOrDefault()?.Note;
        if (!string.IsNullOrWhiteSpace(name)) return name;
        return members.FirstOrDefault(member => member.UserId == confirmer)?.FullName ??
            c.Assignments.Where(assignment => assignment.UserId == confirmer)
                .OrderByDescending(assignment => assignment.AssignedAt).FirstOrDefault()?.FullName;
    }

    private static OperationsPlan ReadOperationsPlan(Campaign c)
    {
        var plan = c.OperationsPlan is { } saved
            ? JsonSerializer.Deserialize<OperationsPlan>(saved, SnapshotJson)! : new OperationsPlan([], [], []);
        return plan with { VolunteerGroups = plan.VolunteerGroups ?? [] };
    }

    private static bool IsOutsideRange(Campaign c, DateOnly? date) => date < c.StartDate || date > c.EndDate;

    private static string FormatOperationsAddress(PlannedCampaignAddress address) =>
        string.Join(", ", new[] { address.Detail, address.Ward?.Name, address.District?.Name, address.Province?.Name }
            .Where(part => !string.IsNullOrWhiteSpace(part)).Select(part => part!.Trim()));

    private static int CalendarLength(Campaign c) =>
        c.StartDate is DateOnly start && c.EndDate is DateOnly end &&
        end.DayNumber - start.DayNumber is >= 0 and < OperationsPlan.MaximumDays
            ? end.DayNumber - start.DayNumber + 1 : 0;

    private static OperationsPlan AddCalendarDays(Campaign c, OperationsPlan plan)
    {
        var length = CalendarLength(c);
        if (length == 0) return plan;
        var start = c.StartDate!.Value;
        var address = ReadConcept(c)?.PlannedAddress;
        var existingDates = plan.Days.Select(day => day.Date).ToHashSet();
        var generated = Enumerable.Range(0, length).Select(start.AddDays)
            .Where(date => !existingDates.Contains(date)).Select(date =>
            {
                var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{c.Id:N}:{date.DayNumber}"));
                return new OperationsDay(new Guid(hash.AsSpan(0, 16)), date,
                    $"Ngày {date.DayNumber - start.DayNumber + 1}", "", "", c.Location, null, "", [], Address: address);
            });
        return plan with { Days = plan.Days.Concat(generated).OrderBy(x => x.Date is null).ThenBy(x => x.Date).ToArray() };
    }

    private static void EnsurePlanning(Campaign c)
    {
        if (c.Status != "PLANNING") throw new ApiException(409, "Chỉ lập kế hoạch khi hồ sơ đã được phân công.");
    }

    private static void ValidateOperations(OperationsPlan plan, CampaignMember[] members, HashSet<Guid> operatorIds)
    {
        if (plan.Days.Any(x => x is null || x.Activities.Any(a => a is null)) ||
            plan.Teams.Any(x => x is null) || plan.VolunteerGroups!.Any(x => x is null))
            throw new ApiException(400, "Kế hoạch chứa mục rỗng.");
        var activities = plan.Days.SelectMany(d => d.Activities).ToArray();
        var ids = plan.Days.Select(x => x.Id).Concat(activities.Select(x => x.Id))
            .Concat(plan.Teams.Select(x => x.Id)).Concat(plan.VolunteerGroups!.Select(x => x.Id)).ToArray();
        if (ids.Contains(Guid.Empty) || ids.Distinct().Count() != ids.Length)
            throw new ApiException(400, "Mã ngày, hoạt động, đội hoặc nhóm tình nguyện bị trùng hoặc rỗng.");

        var memberIds = members.Select(x => x.UserId).ToHashSet();
        var teams = plan.Teams.ToDictionary(x => x.Id);
        var days = plan.Days.ToDictionary(x => x.Id);
        var activityDays = plan.Days.SelectMany(d => d.Activities.Select(a => (a.Id, DayId: d.Id)))
            .ToDictionary(a => a.Id, a => a.DayId);
        var activitiesById = activities.ToDictionary(a => a.Id);
        var leads = plan.Days.Select(x => x.LeadUserId).Concat(activities.Select(x => x.LeadUserId))
            .Concat(activities.Select(x => x.BackupUserId))
            .Concat(plan.Teams.Select(x => x.LeadUserId));
        if (leads.Any(id => id.HasValue && !memberIds.Contains(id.Value)) ||
            plan.Teams.Any(t => t.StaffUserIds.Distinct().Count() != t.StaffUserIds.Length || t.StaffUserIds.Any(id => !memberIds.Contains(id))))
            throw new ApiException(400, "Người phụ trách và thành viên đội phải là nhân sự đang hoạt động trong tổ chức.");
        if (plan.Teams.Any(team => team.LeadUserId is Guid leadUserId && operatorIds.Contains(leadUserId)))
            throw new ApiException(400, "Người được phân công vận hành không được làm trưởng đội nhân sự.");
        if (activities.Any(activity => activity.BackupUserId.HasValue && activity.BackupUserId == activity.LeadUserId))
            throw new ApiException(400, "Người thay thế phải khác người phụ trách chính.");
        if (plan.Days.Any(day => day.Address is { } address &&
            (FormatOperationsAddress(address).Length > 400 ||
                (address.Province is null && (address.District is not null || address.Ward is not null)) ||
                (address.Mode == "CURRENT" && address.District is not null) ||
                (address.Mode == "LEGACY" && address.Ward is not null && address.District is null))))
            throw new ApiException(400, "Địa chỉ triển khai không hợp lệ.");
        if (activities.Any(a => a.TeamIds.Distinct().Count() != a.TeamIds.Length || a.TeamIds.Any(id => !teams.ContainsKey(id))) ||
            plan.VolunteerGroups!.Any(r => (r.DayId is Guid dayId && !days.ContainsKey(dayId)) ||
                (r.ActivityId is Guid activityId && (!activityDays.TryGetValue(activityId, out var linkedDay) ||
                    r.DayId != linkedDay)) ||
                (r.TeamId is Guid teamId && (!teams.ContainsKey(teamId) ||
                    (r.ActivityId is Guid linkedActivity && !activitiesById[linkedActivity].TeamIds.Contains(teamId))))))
            throw new ApiException(400, "Nhóm tình nguyện phải liên kết với ngày, hoạt động và đội phù hợp trong kế hoạch.");
        if (plan.VolunteerGroups!.Any(group => !string.IsNullOrWhiteSpace(group.CategoryId) &&
            !VolunteerGroupCategories.Any(category => category.Id == group.CategoryId)))
            throw new ApiException(400, "Loại nhóm tình nguyện không có trong danh mục.");
        if (plan.Days.Where(day => day.Date.HasValue).GroupBy(day => day.Date).Any(group => group.Count() > 1))
            throw new ApiException(400, "Mỗi ngày chỉ có một mục lịch. Hãy thêm nhiều hoạt động vào cùng ngày.");
        if (activities.Any(x => x.Start.HasValue && x.End.HasValue && x.Start >= x.End))
            throw new ApiException(400, "Giờ kết thúc hoạt động phải sau giờ bắt đầu.");
        CheckOverlap(plan, teams);
        if (plan.Days.Any(day => day.ActivitiesDone && (day.Date is null || day.Activities.Any(ActivityIncomplete))))
            throw new ApiException(400, "Hãy điền ngày và hoàn tất thông tin hoạt động trước khi đánh dấu xong.");
    }

    private static bool ActivityIncomplete(OperationsActivity x) => x.Start is null || x.End is null ||
        x.LeadUserId is null || string.IsNullOrWhiteSpace(x.Title) ||
        string.IsNullOrWhiteSpace(x.Tasks) || string.IsNullOrWhiteSpace(x.Location);

    private static void ValidateConfirmation(OperationsPlan plan)
    {
        var activities = plan.Days.SelectMany(day => day.Activities).ToArray();
        if (activities.Length == 0 || plan.Days.Any(x => x.Date is null || string.IsNullOrWhiteSpace(x.Title)) ||
            activities.Any(ActivityIncomplete) ||
            plan.Teams.Any(x => x.LeadUserId is null || string.IsNullOrWhiteSpace(x.Name) || string.IsNullOrWhiteSpace(x.Duties)) ||
            plan.VolunteerGroups!.Any(x => string.IsNullOrWhiteSpace(x.Name) || string.IsNullOrWhiteSpace(x.CategoryId) ||
                x.VolunteerCount <= 0 || x.MinimumConfirmed > x.VolunteerCount || x.DayId is null || x.TeamId is null))
            throw new ApiException(400, "Hãy hoàn thành lịch, đội và các nhóm tình nguyện đã thêm trước khi xác nhận.");
    }

    private static void ValidateVolunteerCapacity(OperationsPlan plan)
    {
        var teams = plan.Teams.ToDictionary(team => team.Id);
        foreach (var dayAndTeam in plan.VolunteerGroups!.GroupBy(group => (group.DayId, group.TeamId)))
        {
            var allDay = dayAndTeam.Where(group => group.ActivityId is null).Sum(group => group.VolunteerCount);
            var peakActivity = dayAndTeam.Where(group => group.ActivityId.HasValue).GroupBy(group => group.ActivityId)
                .Select(groups => groups.Sum(group => group.VolunteerCount)).DefaultIfEmpty().Max();
            var team = teams[dayAndTeam.Key.TeamId!.Value];
            if (allDay + peakActivity > team.VolunteersNeeded)
                throw new ApiException(400, $"Số người phân bổ vượt chỉ tiêu tình nguyện của đội {team.Name} trong ngày.");
        }
    }

    private static void CheckOverlap(OperationsPlan plan, Dictionary<Guid, OperationsTeam> teams)
    {
        var scheduled = plan.Days.Where(d => d.Date.HasValue).GroupBy(d => d.Date);
        foreach (var date in scheduled)
        {
            var slots = date.SelectMany(d => d.Activities).Where(a => a.Start.HasValue && a.End.HasValue)
                .Select(a => (Activity: a, Staff: a.TeamIds.SelectMany(id => teams[id].StaffUserIds
                    .Concat(teams[id].LeadUserId is Guid lead ? [lead] : []))
                    .Concat(a.LeadUserId is Guid ownLead ? [ownLead] : [])
                    .Concat(a.BackupUserId is Guid backup ? [backup] : []).ToHashSet()))
                .OrderBy(a => a.Activity.Start).ToArray();
            for (var i = 0; i < slots.Length; i++)
                for (var j = i + 1; j < slots.Length && slots[j].Activity.Start < slots[i].Activity.End; j++)
                    if (slots[i].Staff.Overlaps(slots[j].Staff) || slots[i].Activity.TeamIds.Intersect(slots[j].Activity.TeamIds).Any())
                        throw new ApiException(400, "Một người hoặc đội được phân công vào hai hoạt động trùng giờ.");
        }
    }
}
