using System.Net.Http.Json;
using System.Text.Json;
using CampaignService.Contracts;
using CampaignService.Data;
using Shared;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    private const string ScheduleProposal = "SCHEDULE_CHANGE_REQUEST";
    private const string ScheduleApprove = "SCHEDULE_CHANGE_APPROVE";
    private const string ScheduleReject = "SCHEDULE_CHANGE_REJECT";

    public async Task<ScheduleChangeView> ScheduleChange(Guid id, Guid actor, CancellationToken ct)
    {
        var row = await Get(id, ct);
        var permission = await RequireRead(row, actor, ct);
        var (_, snapshot) = PublicScheduleSnapshot(row);
        return ScheduleChangeDetails(row, snapshot, permission, actor);
    }

    public async Task<ScheduleChangeView> RequestScheduleChange(Guid id, ScheduleChangeRequest request, Guid actor, CancellationToken ct)
    {
        var row = await Get(id, ct);
        var permission = await RequireRead(row, actor, ct);
        var (submission, snapshot) = PublicScheduleSnapshot(row);
        var view = ScheduleChangeDetails(row, snapshot, permission, actor);
        if (!view.CanRequest) throw new ApiException(403, "Chỉ quản lý chiến dịch được phân công có thể gửi đề xuất.");
        Match(row, request.Version);
        if (view.Pending is not null) throw new ApiException(409, "Đã có một đề xuất đang chờ Owner xử lý.");
        var slot = view.Slots.SingleOrDefault(item => item.DayId == request.DayId && item.ActivityId == request.ActivityId);
        var location = request.Location.Trim();
        var reason = request.Reason.Trim();
        if (slot is null || location.Length < 5 || reason.Length < 5 || location == slot.Location)
            throw new ApiException(400, "Chọn ca, địa điểm mới và ghi lý do thay đổi.");
        var proposal = new ScheduleChangeProposal(Guid.NewGuid(), submission.Id, actor, DateTimeOffset.UtcNow, slot, location, reason);
        row.Reviews.Add(new CampaignReview { Id = proposal.Id, CampaignId = row.Id, ActorId = actor, CreatedAt = proposal.RequestedAt,
            Action = ScheduleProposal, SubmittedSnapshot = JsonSerializer.Serialize(proposal, SnapshotJson) });
        row.UpdatedAt = proposal.RequestedAt;
        await repository.Save(ct);
        return ScheduleChangeDetails(row, snapshot, permission, actor);
    }

    public async Task<ScheduleChangeView> DecideScheduleChange(Guid id, ScheduleChangeDecision request, Guid actor, CancellationToken ct)
    {
        var row = await Get(id, ct);
        var permission = await access.Require(row.OrganizationId, actor, ["OWNER"], ct);
        var (submission, snapshot) = PublicScheduleSnapshot(row);
        var view = ScheduleChangeDetails(row, snapshot, permission, actor);
        if (!view.CanDecide) throw new ApiException(409, "Chương trình đã bắt đầu hoặc người gửi đang dùng cùng tài khoản.");
        Match(row, request.Version);
        if (view.Pending is not { } proposal || proposal.Id != request.ChangeId || proposal.SubmissionId != submission.Id)
            throw new ApiException(409, "Đề xuất đang chờ duyệt đã thay đổi.");
        var note = request.Note.Trim();
        if (note.Length < 3) throw new ApiException(400, "Ghi lý do quyết định.");
        if (request.Approve)
        {
            OperationsPlan WithLocation(OperationsPlan plan) => plan with
            {
                Days = plan.Days.Select(day => day.Id != proposal.Before.DayId ? day : day with
                {
                    Activities = day.Activities.Select(activity => activity.Id == proposal.Before.ActivityId
                        ? activity with { Location = proposal.NewLocation } : activity).ToArray()
                }).ToArray()
            };
            snapshot = snapshot with { Operations = WithLocation(snapshot.Operations) };
            row.OperationsPlan = JsonSerializer.Serialize(WithLocation(ReadOperationsPlan(row)), SnapshotJson);
            Audit(row, proposal.RequestedBy, FinalSubmitAction, snapshot: JsonSerializer.Serialize(snapshot, SnapshotJson));
            await QueueScheduleNotifications(row, snapshot.Operations, proposal, ct);
        }
        Audit(row, actor, request.Approve ? ScheduleApprove : ScheduleReject, note, proposal.Id.ToString());
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await repository.Save(ct);
        return ScheduleChangeDetails(row, snapshot, permission, actor);
    }

    private async Task QueueScheduleNotifications(Campaign row, OperationsPlan operations, ScheduleChangeProposal change, CancellationToken ct)
    {
        var day = operations.Days.Single(item => item.Id == change.Before.DayId);
        var slot = day.Activities.Single(item => item.Id == change.Before.ActivityId);
        var groupIds = (operations.VolunteerGroups ?? []).Where(group => group.DayId == day.Id &&
            (group.ActivityId is null || group.ActivityId == slot.Id)).Select(group => group.Id).ToArray();
        Guid[] volunteers = [];
        if (groupIds.Length > 0)
        {
            try
            {
                using var response = await clients.CreateClient("launch-volunteer").PostAsJsonAsync(
                    $"internal/launch/campaigns/{row.Id}/recipients", groupIds, ct);
                response.EnsureSuccessStatusCode();
                volunteers = await response.Content.ReadFromJsonAsync<Guid[]>(ct) ?? [];
            }
            catch (Exception ex) when (!ct.IsCancellationRequested && ex is HttpRequestException or OperationCanceledException or JsonException)
            {
                throw new ApiException(503, "Chưa xác định được người cần thông báo. Vui lòng thử duyệt lại.");
            }
        }
        var staff = operations.Teams.Where(team => slot.TeamIds.Contains(team.Id))
            .SelectMany(team => team.StaffUserIds.Concat(team.LeadUserId.HasValue ? [team.LeadUserId.Value] : []));
        var recipients = volunteers.Concat(staff).Append(change.RequestedBy)
            .Concat(slot.LeadUserId.HasValue ? [slot.LeadUserId.Value] : []).Distinct();
        foreach (var recipient in recipients)
        {
            var eventId = Guid.NewGuid();
            var item = new CampaignAssignmentEvent(eventId, row.OrganizationId, row.Id, recipient, row.Title,
                [], ScheduleChanged: true);
            db.AssignmentNotifications.Add(new CampaignNotification
            {
                Id = eventId, Payload = JsonSerializer.Serialize(item, SnapshotJson), NextAttemptAt = DateTimeOffset.UtcNow
            });
        }
    }

    private static ScheduleChangeView ScheduleChangeDetails(Campaign row, FinalSnapshot snapshot, OrganizationPermission permission, Guid actor)
    {
        var pending = PendingScheduleChange(row);
        var slots = row.StartedAt.HasValue || snapshot.Concept.EventFormat == "ONLINE" ? [] :
            snapshot.Operations.Days.Where(day => day.Date.HasValue).SelectMany(day => day.Activities.Select(activity =>
                new ScheduleChangeSlot(day.Id, activity.Id, day.Date!.Value, activity.Title, activity.Location))).ToArray();
        return new(Convert.ToBase64String(row.Version),
            slots.Length > 0 && HasAssignment(row, actor, permission, "CAMPAIGN_MANAGER"),
            slots.Length > 0 && permission.Roles.Contains("OWNER") && pending?.RequestedBy != actor, slots, pending);
    }

    private static ScheduleChangeProposal? PendingScheduleChange(Campaign row)
    {
        var closed = row.Reviews.Where(item => item.Action is ScheduleApprove or ScheduleReject)
            .Select(item => item.SubmittedSnapshot).ToHashSet();
        var pending = row.Reviews.Where(item => item.Action == ScheduleProposal && !closed.Contains(item.Id.ToString()))
            .OrderByDescending(item => item.CreatedAt).FirstOrDefault();
        return pending is null ? null : JsonSerializer.Deserialize<ScheduleChangeProposal>(pending.SubmittedSnapshot!, SnapshotJson);
    }

    private static (CampaignReview Submission, FinalSnapshot Snapshot) PublicScheduleSnapshot(Campaign row)
    {
        var submission = FinalSubmission(row);
        if (row.Status != "PUBLISHED" || submission?.SubmittedSnapshot is null)
            throw new ApiException(409, "Cần có kế hoạch cuối đã công bố.");
        return (submission, JsonSerializer.Deserialize<FinalSnapshot>(submission.SubmittedSnapshot, SnapshotJson)!);
    }
}
