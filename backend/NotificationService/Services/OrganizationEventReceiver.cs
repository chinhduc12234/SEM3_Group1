using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NotificationService.Data;
using NotificationService.Models;
using Shared;

namespace NotificationService.Services;

public sealed class OrganizationEventReceiver(NotificationDb db, IHttpClientFactory clients)
{
    public async Task Receive(OrganizationNotificationEvent item, CancellationToken ct)
    {
        if (item.EventId == Guid.Empty || item.OrganizationId == Guid.Empty || item.ApplicantUserId == Guid.Empty ||
            item.Action is not ("SUBMITTED" or "APPROVE" or "REQUEST_CHANGES" or "REJECT") ||
            string.IsNullOrWhiteSpace(item.OrganizationName) || item.OrganizationName.Length > 200 || item.OccurredAt == default)
            throw new ApiException(400, "Sự kiện thông báo không hợp lệ.");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(item))));
        // Single receiver at a time also makes concurrent HTTP retries idempotent.
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Notification.Receive");
        if (!await gate.Acquire(ct)) throw new ApiException(503, "Hệ thống đang tiếp nhận sự kiện, vui lòng thử lại.");
        var existing = await db.ReceivedEvents.AsNoTracking().SingleOrDefaultAsync(x => x.Id == item.EventId, ct);
        if (existing is not null)
        {
            if (existing.PayloadHash != hash) throw new ApiException(409, "Mã sự kiện đã tồn tại với nội dung khác.");
            return;
        }
        Guid[] recipients;
        if (item.Action == "SUBMITTED")
        {
            using var response = await clients.CreateClient("identity").GetAsync("internal/accounts/administrators", ct);
            response.EnsureSuccessStatusCode();
            recipients = await response.Content.ReadFromJsonAsync<Guid[]>(ct) ?? [];
            if (recipients.Length == 0) throw new ApiException(503, "Chưa có quản trị viên nhận thông báo.");
        }
        else recipients = [item.ApplicantUserId];

        var title = item.Action switch
        {
            "SUBMITTED" => "Có hồ sơ tổ chức cần xét duyệt",
            "APPROVE" => "Tổ chức của bạn đã được phê duyệt",
            "REQUEST_CHANGES" => "Hồ sơ tổ chức cần bổ sung",
            _ => "Hồ sơ tổ chức đã bị từ chối"
        };
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.ReceivedEvents.Add(new ReceivedEvent { Id = item.EventId, PayloadHash = hash });
        foreach (var user in recipients.Distinct())
        {
            var notification = new Notification { EventId = item.EventId, OrganizationId = item.OrganizationId, UserId = user,
                Kind = item.Action, Title = title, Message = item.OrganizationName + ". Mở hồ sơ để xem chi tiết và hướng dẫn xử lý.",
                Url = item.Action == "SUBMITTED" ? $"/admin/organizations/{item.OrganizationId}" :
                    item.Action == "APPROVE" ? $"/organizations/{item.OrganizationId}/manage" : $"/organizations/{item.OrganizationId}" };
            db.Notifications.Add(notification);
            var devices = await db.Subscriptions.Where(x => x.UserId == user && x.IsActive).ToListAsync(ct);
            foreach (var device in devices) db.Deliveries.Add(new PushDelivery { NotificationId = notification.Id,
                SubscriptionId = device.Id, UserId = user, SessionId = device.SessionId });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
