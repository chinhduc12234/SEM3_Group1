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
            string.IsNullOrWhiteSpace(item.VolunteerName) || item.VolunteerName.Length > 200 || item.SubmittedAt == default ||
            item.RecipientUserId == Guid.Empty ||
            item.Outcome is not (null or "OFFERED" or "WAITLISTED" or "UNDER_REVIEW" or "REJECTED" or "EXPIRED" or "REMOVED") ||
            (item.Outcome == "REMOVED" && item.RecipientUserId is null))
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
        if (item.RecipientUserId is null && recipients.UserIds.Length == 0)
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

        var targets = item.RecipientUserId is Guid recipient ? [recipient] : recipients.UserIds.Distinct().ToArray();
        var title = item.Outcome switch
        {
            "OFFERED" => "Vui lòng xác nhận ca tình nguyện",
            "WAITLISTED" => "Hồ sơ tình nguyện đang trong danh sách chờ",
            "UNDER_REVIEW" => "Hồ sơ tình nguyện cần được xem xét",
            "REJECTED" => "Đã có kết quả xét duyệt hồ sơ tình nguyện",
            "EXPIRED" => "Suất tình nguyện đã hết hạn xác nhận",
            "REMOVED" => "Bạn đã bị gỡ quyền tình nguyện viên",
            _ => "Có hồ sơ tình nguyện mới"
        };
        var message = item.Outcome == "REMOVED" ? recipients.CampaignTitle :
            item.RecipientUserId.HasValue ? $"{recipients.CampaignTitle}. Mở Hoạt động của tôi để xem chi tiết."
            : $"{item.VolunteerName} đã đăng ký tham gia chiến dịch {recipients.CampaignTitle}.";
        var url = item.Outcome == "REMOVED" ? $"/account/history?removal={item.RegistrationId}" :
            item.RecipientUserId.HasValue ? $"/account/history?registration={item.RegistrationId}"
            : $"/organizations/{recipients.OrganizationId}/manage/volunteers/{item.CampaignId}";
        var notifications = targets.Select(userId => new Notification
        {
            EventId = item.EventId,
            OrganizationId = recipients.OrganizationId,
            UserId = userId,
            Kind = "VOLUNTEER_REGISTRATION_" + (item.Outcome ?? "SUBMITTED"),
            Title = title,
            Message = message,
            Url = url,
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
