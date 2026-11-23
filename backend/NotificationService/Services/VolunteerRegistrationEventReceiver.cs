using System.Security.Cryptography;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NotificationService.Data;
using NotificationService.Models;
using Shared;

namespace NotificationService.Services;

public sealed class VolunteerRegistrationEventReceiver(NotificationDb db, IHttpClientFactory clients)
{
    public async Task Receive(VolunteerRegistrationNotificationEvent item, CancellationToken ct)
    {
        if (item.EventId == Guid.Empty || item.CampaignId == Guid.Empty || item.RegistrationId == Guid.Empty ||
            string.IsNullOrWhiteSpace(item.VolunteerName) || item.VolunteerName.Length > 200 || item.SubmittedAt == default)
            throw new ApiException(400, "Sự kiện hồ sơ tình nguyện không hợp lệ.");

        using var response = await clients.CreateClient("campaign")
            .GetAsync($"internal/campaigns/{item.CampaignId}/volunteer-review-recipients", ct);
        if (!response.IsSuccessStatusCode)
            throw new ApiException(503, "Chưa lấy được danh sách quản lý nhân sự của chiến dịch.");
        var recipients = await response.Content.ReadFromJsonAsync<VolunteerReviewRecipients>(ct)
            ?? throw new ApiException(503, "Danh sách quản lý nhân sự không hợp lệ.");
        if (recipients.CampaignId != item.CampaignId || recipients.OrganizationId == Guid.Empty ||
            string.IsNullOrWhiteSpace(recipients.CampaignTitle))
            throw new ApiException(503, "Thông tin chiến dịch nhận hồ sơ không hợp lệ.");
        if (recipients.UserIds.Length == 0)
            throw new ApiException(503, "Chiến dịch chưa phân công quản lý nhân sự để nhận hồ sơ.");

        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(item))));
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Notification.VolunteerRegistration");
        if (!await gate.Acquire(ct)) throw new ApiException(503, "Hệ thống đang nhận thông báo, vui lòng thử lại.");
        var existing = await db.ReceivedEvents.AsNoTracking().SingleOrDefaultAsync(x => x.Id == item.EventId, ct);
        if (existing is not null)
        {
            if (existing.PayloadHash != payloadHash) throw new ApiException(409, "Mã sự kiện đã tồn tại với nội dung khác.");
            return;
        }

        var notifications = recipients.UserIds.Distinct().Select(userId => new Notification
        {
            EventId = item.EventId,
            OrganizationId = recipients.OrganizationId,
            UserId = userId,
            Kind = "VOLUNTEER_REGISTRATION_SUBMITTED",
            Title = "Có hồ sơ tình nguyện mới",
            Message = $"{item.VolunteerName} đã đăng ký tham gia chiến dịch {recipients.CampaignTitle}.",
            Url = $"/organizations/{recipients.OrganizationId}/manage/operations/{item.CampaignId}",
            CreatedAt = item.SubmittedAt
        }).ToArray();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.ReceivedEvents.Add(new ReceivedEvent { Id = item.EventId, PayloadHash = payloadHash });
        foreach (var notification in notifications)
        {
            db.Notifications.Add(notification);
            var devices = await db.Subscriptions.Where(x => x.UserId == notification.UserId && x.IsActive).ToListAsync(ct);
            foreach (var device in devices)
                db.Deliveries.Add(new PushDelivery { NotificationId = notification.Id, SubscriptionId = device.Id,
                    UserId = notification.UserId, SessionId = device.SessionId });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
