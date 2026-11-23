using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NotificationService.Data;
using NotificationService.Models;
using Shared;

namespace NotificationService.Services;

public sealed class DonationEventReceiver(NotificationDb db)
{
    public async Task ReceiveGoalReached(FundraisingGoalReachedNotificationEvent item, CancellationToken ct)
    {
        if (item.EventId == Guid.Empty || item.CampaignId == Guid.Empty || item.OrganizationId == Guid.Empty ||
            string.IsNullOrWhiteSpace(item.CampaignTitle) || item.CampaignTitle.Length > 200 ||
            item.ManagerUserIds is null || item.ManagerUserIds.Length is 0 or > 100 || item.ClosedAt == default)
            throw new ApiException(400, "Sự kiện đạt mục tiêu gây quỹ không hợp lệ.");
        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(item))));
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Notification.Donation");
        if (!await gate.Acquire(ct)) throw new ApiException(503, "Hệ thống đang nhận thông báo, vui lòng thử lại.");
        var existing = await db.ReceivedEvents.AsNoTracking().SingleOrDefaultAsync(x => x.Id == item.EventId, ct);
        if (existing is not null)
        {
            if (existing.PayloadHash != payloadHash) throw new ApiException(409, "Mã sự kiện đã tồn tại với nội dung khác.");
            return;
        }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.ReceivedEvents.Add(new ReceivedEvent { Id = item.EventId, PayloadHash = payloadHash });
        foreach (var userId in item.ManagerUserIds.Distinct())
        {
            db.Notifications.Add(new Notification
            {
                EventId = item.EventId, OrganizationId = item.OrganizationId, UserId = userId,
                Kind = "FUNDRAISING_GOAL_REACHED", Title = "Chiến dịch đã đạt đủ mục tiêu hỗ trợ",
                Message = $"Chiến dịch {item.CampaignTitle} đã đạt đủ các mục tiêu tiền và hiện vật. Hệ thống đã đóng nhận ủng hộ; chiến dịch vẫn tiếp tục triển khai.",
                Url = $"/organizations/{item.OrganizationId}/manage/budget/{item.CampaignId}", CreatedAt = item.ClosedAt
            });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task Receive(DonationConfirmedNotificationEvent item, CancellationToken ct)
    {
        if (item.EventId == Guid.Empty || item.DonationId == Guid.Empty || item.CampaignId == Guid.Empty ||
            item.OrganizationId == Guid.Empty || item.DonorUserId == Guid.Empty || item.Amount <= 0 ||
            string.IsNullOrWhiteSpace(item.DonorName) || item.DonorName.Length > 200 ||
            string.IsNullOrWhiteSpace(item.TargetName) || item.TargetName.Length > 200 ||
            string.IsNullOrWhiteSpace(item.CampaignTitle) || item.CampaignTitle.Length > 200 ||
            item.FinanceUserIds is null || item.FinanceUserIds.Length > 100 || item.ConfirmedAt == default)
            throw new ApiException(400, "Sự kiện xác nhận khoản ủng hộ không hợp lệ.");

        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(item))));
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Notification.Donation");
        if (!await gate.Acquire(ct)) throw new ApiException(503, "Hệ thống đang nhận thông báo, vui lòng thử lại.");
        var existing = await db.ReceivedEvents.AsNoTracking().SingleOrDefaultAsync(x => x.Id == item.EventId, ct);
        if (existing is not null)
        {
            if (existing.PayloadHash != payloadHash) throw new ApiException(409, "Mã sự kiện đã tồn tại với nội dung khác.");
            return;
        }

        var managerMessage = $"{item.DonorName} đã ủng hộ {item.Amount:N0} đ cho khoản {item.TargetName} của chiến dịch {item.CampaignTitle} (mô phỏng).";
        var donorMessage = $"Khoản ủng hộ {item.Amount:N0} đ cho {item.TargetName} trong chiến dịch {item.CampaignTitle} đã được ghi nhận (mô phỏng).";
        var recipients = item.FinanceUserIds.Append(item.DonorUserId).Distinct().Select(userId =>
        {
            var isDonor = userId == item.DonorUserId;
            return new Notification
            {
                EventId = item.EventId, OrganizationId = item.OrganizationId, UserId = userId,
                Kind = "DONATION_CONFIRMED",
                Title = isDonor ? "Khoản ủng hộ đã được ghi nhận" : "Có khoản ủng hộ mới",
                Message = isDonor ? donorMessage : managerMessage,
                Url = isDonor ? "/notifications" : $"/organizations/{item.OrganizationId}/manage/budget/{item.CampaignId}",
                CreatedAt = item.ConfirmedAt
            };
        }).ToArray();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.ReceivedEvents.Add(new ReceivedEvent { Id = item.EventId, PayloadHash = payloadHash });
        foreach (var notification in recipients)
        {
            db.Notifications.Add(notification);
            var devices = await db.Subscriptions.Where(x => x.UserId == notification.UserId && x.IsActive).ToListAsync(ct);
            foreach (var device in devices) db.Deliveries.Add(new PushDelivery { NotificationId = notification.Id,
                SubscriptionId = device.Id, UserId = notification.UserId, SessionId = device.SessionId });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
