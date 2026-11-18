using System.Text.Json;
using CampaignService.Contracts;
using CampaignService.Data;
using Shared;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    private const string ActivityReportKind = "ACTIVITY_REPORT";
    private const string ActivityReportAction = "SEND_ACTIVITY_PHOTO";
    private const string OperationsRole = "VOLUNTEER_COORDINATOR";

    private async Task<OrganizationPermission> RequireActivityReportAccess(Campaign campaign, Guid? actor, CancellationToken ct)
    {
        var permission = await RequireRead(campaign, actor, ct);
        if (!permission.Roles.Contains("OWNER") && !HasAssignment(campaign, actor!.Value, permission, OperationsRole))
            throw new ApiException(403, "Chỉ Owner và người được phân công vận hành có thể xem báo cáo ảnh.");
        return permission;
    }

    private static IEnumerable<ActivityPhotoReport> ReadActivityPhotoReports(Campaign campaign) =>
        campaign.Reviews.Where(review => review.Action == ActivityReportAction && review.SubmittedSnapshot is not null)
            .Select(review => JsonSerializer.Deserialize<ActivityPhotoReport>(review.SubmittedSnapshot!, SnapshotJson))
            .OfType<ActivityPhotoReport>();

    public async Task<ActivityPhotoReport[]> ActivityPhotoReports(Guid id, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        await RequireActivityReportAccess(campaign, actor, ct);
        return ReadActivityPhotoReports(campaign).OrderByDescending(report => report.SentAt).ToArray();
    }

    public async Task<ActivityPhotoReport> SendActivityPhoto(Guid id, Guid activityId, Guid reportId, string? note,
        IFormFile file, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireActivityReportAccess(campaign, actor, ct);
        if (!HasAssignment(campaign, actor, permission, OperationsRole))
            throw new ApiException(403, "Chỉ người được phân công vận hành có thể gửi báo cáo.");
        if (campaign.Status != "PLANNING" && !IsModernPublication(campaign))
            throw new ApiException(409, "Hồ sơ hiện không nhận báo cáo ảnh.");
        if (ReadActivityPhotoReports(campaign).FirstOrDefault(report => report.Id == reportId && report.ActivityId == activityId) is { } existing)
            return existing;
        var day = ReadOperationsPlan(campaign).Days.FirstOrDefault(day => day.Activities.Any(activity => activity.Id == activityId))
            ?? throw new ApiException(404, "Hãy lưu hoạt động vào kế hoạch trước khi gửi ảnh.");
        var activity = day.Activities.Single(activity => activity.Id == activityId);
        note = note?.Trim() ?? "";
        if (reportId == Guid.Empty || note.Length > 500 || file.Length is < 8 or > 5 * 1024 * 1024)
            throw new ApiException(400, "Ảnh tối đa 5 MB và ghi chú tối đa 500 ký tự.");

        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, ct);
        var bytes = stream.ToArray();
        var type = bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? "image/png"
            : bytes.AsSpan().StartsWith(new byte[] { 255, 216, 255 }) ? "image/jpeg"
            : throw new ApiException(400, "Ảnh báo cáo chỉ nhận JPG hoặc PNG.");
        var members = await access.Members(campaign.OrganizationId, ct);
        var owners = members.Where(member => member.Roles.Contains("OWNER")).Select(member => member.UserId).Distinct().ToArray();
        if (owners.Length == 0) throw new ApiException(409, "Chưa tìm thấy Owner để nhận báo cáo.");
        var report = new ActivityPhotoReport(reportId, activityId, activity.Title, day.Title, day.Date,
            members.FirstOrDefault(member => member.UserId == actor)?.FullName ?? "Nhân sự vận hành", note, DateTimeOffset.UtcNow);

        var root = UploadRoot();
        Directory.CreateDirectory(root);
        var storagePath = $"{Guid.NewGuid():N}.bin";
        var path = Path.Combine(root, storagePath);
        try
        {
            await File.WriteAllBytesAsync(path, bytes, ct);
            campaign.Media.Add(new CampaignMedia { Id = reportId, CampaignId = id, Kind = ActivityReportKind,
                FileName = type == "image/png" ? "bao-cao.png" : "bao-cao.jpg", ContentType = type, StoragePath = storagePath });
            Audit(campaign, actor, ActivityReportAction, snapshot: JsonSerializer.Serialize(report, SnapshotJson));
            foreach (var ownerId in owners)
            {
                var eventId = Guid.NewGuid();
                var payload = new CampaignAssignmentEvent(eventId, campaign.OrganizationId, id, ownerId,
                    campaign.Title, [OperationsRole], report.Id);
                db.AssignmentNotifications.Add(new CampaignNotification { Id = eventId,
                    NextAttemptAt = report.SentAt, Payload = JsonSerializer.Serialize(payload, SnapshotJson) });
            }
            await repository.Save(ct);
        }
        catch { RemoveUpload(storagePath); throw; }
        return report;
    }
}
