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
    public async Task ReceiveInKindPledge(InKindPledgeNotificationEvent item, CancellationToken ct)
    {
        if (item.EventId == Guid.Empty || item.PledgeId == Guid.Empty || item.CampaignId == Guid.Empty ||
            item.OrganizationId == Guid.Empty || item.DonorUserId == Guid.Empty ||
            string.IsNullOrWhiteSpace(item.DonorName) || item.DonorName.Length > 200 ||
            string.IsNullOrWhiteSpace(item.TargetName) || item.TargetName.Length > 200 ||
            string.IsNullOrWhiteSpace(item.CampaignTitle) || item.CampaignTitle.Length > 200 ||
            string.IsNullOrWhiteSpace(item.Unit) || item.Unit.Length > 40 || item.Quantity <= 0 ||
            item.ReceivedQuantity < 0 || item.ReceivedQuantity > item.Quantity || item.ReceivedNow < 0 ||
            item.ReceivedNow > item.Quantity || item.OccurredAt == default ||
            item.ManagerUserIds is null || item.ManagerUserIds.Length > 100 ||
            item.EventType is not ("SUBMITTED" or "APPROVED" or "REJECTED" or "RECEIVED"))
            throw new ApiException(400, "Sự kiện đề nghị tặng hiện vật không hợp lệ.");
        if (item.EventType == "SUBMITTED" && item.ManagerUserIds.Length == 0)
            throw new ApiException(503, "Chiến dịch chưa phân công quản lý để nhận đề nghị hiện vật.");

        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(item))));
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), "GiveAid.Notification.Donation");
        if (!await gate.Acquire(ct)) throw new ApiException(503, "Hệ thống đang nhận thông báo, vui lòng thử lại.");
        var existing = await db.ReceivedEvents.AsNoTracking().SingleOrDefaultAsync(x => x.Id == item.EventId, ct);
        if (existing is not null)
        {
            if (existing.PayloadHash != payloadHash) throw new ApiException(409, "Mã sự kiện đã tồn tại với nội dung khác.");
            return;
        }

        var isSubmission = item.EventType == "SUBMITTED";
        Guid[] recipients = isSubmission ? item.ManagerUserIds.Distinct().ToArray() : new[] { item.DonorUserId };
        var message = item.EventType switch
        {
            "SUBMITTED" => $"{item.DonorName} đề nghị tặng {item.Quantity:N2} {item.Unit} cho khoản {item.TargetName} của chiến dịch {item.CampaignTitle}.",
            "APPROVED" => $"Đề nghị tặng {item.Quantity:N2} {item.Unit} cho khoản {item.TargetName} trong chiến dịch {item.CampaignTitle} đã được duyệt.",
            "REJECTED" => $"Đề nghị tặng {item.Quantity:N2} {item.Unit} cho khoản {item.TargetName} trong chiến dịch {item.CampaignTitle} đã bị từ chối.",
            _ => $"Chiến dịch {item.CampaignTitle} đã ghi nhận thêm {item.ReceivedNow:N2} {item.Unit} cho khoản {item.TargetName}; tổng đã nhận {item.ReceivedQuantity:N2}/{item.Quantity:N2} {item.Unit}."
        };
        if (message.Length > 500) message = message[..497] + "...";
        var notification = new Notification
        {
            EventId = item.EventId,
            OrganizationId = item.OrganizationId,
            UserId = recipients[0],
            Kind = item.EventType switch
            {
                "SUBMITTED" => "IN_KIND_PLEDGE_SUBMITTED",
                "APPROVED" => "IN_KIND_PLEDGE_APPROVED",
                "REJECTED" => "IN_KIND_PLEDGE_REJECTED",
                _ => "IN_KIND_PLEDGE_RECEIVED"
            },
            Title = item.EventType switch
            {
                "SUBMITTED" => "Có đề nghị tặng hiện vật mới",
                "APPROVED" => "Đề nghị tặng hiện vật đã được duyệt",
                "REJECTED" => "Đề nghị tặng hiện vật chưa được duyệt",
                _ => "Đã ghi nhận nhận hiện vật"
            },
            Message = message,
            Url = isSubmission
                ? $"/organizations/{item.OrganizationId}/manage/budget/{item.CampaignId}"
                : "/account/history",
            CreatedAt = item.OccurredAt
        };

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.ReceivedEvents.Add(new ReceivedEvent { Id = item.EventId, PayloadHash = payloadHash });
        foreach (var userId in recipients)
        {
            var recipientNotification = new Notification
            {
                EventId = notification.EventId,
                OrganizationId = notification.OrganizationId,
                UserId = userId,
                Kind = notification.Kind,
                Title = notification.Title,
                Message = notification.Message,
                Url = notification.Url,
                CreatedAt = notification.CreatedAt
            };
            db.Notifications.Add(recipientNotification);
            var devices = await db.Subscriptions.Where(x => x.UserId == userId && x.IsActive).ToListAsync(ct);
            foreach (var device in devices)
                db.Deliveries.Add(new PushDelivery { NotificationId = recipientNotification.Id,
                    SubscriptionId = device.Id, UserId = userId, SessionId = device.SessionId });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

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
