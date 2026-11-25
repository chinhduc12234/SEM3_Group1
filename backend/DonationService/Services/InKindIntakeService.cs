using System.Security.Cryptography;
using System.Text.Json;
using DonationService.Contracts;
using DonationService.Data;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace DonationService.Services;

public sealed class InKindIntakeService(DonationDb db, CampaignDonationClient campaigns,
    DonationAccountDirectory accounts, FundraisingProgressService progress, DonationLaunchReadiness launch)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<PublicInKindPoint> PublicPoint(Guid campaignId, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct, includeRecipients: false);
        var point = RequirePoint(context);
        return new(point.Id, point.Address, point.ReceivingHours, point.Contact,
            point.OpensAt, point.ClosesAt, point.AppointmentsPerHour, context.OpensOn, context.ClosesOn, context.Timezone);
    }

    public async Task<InKindPledgeView> Schedule(Guid donorId, ScheduleInKindRequest input, CancellationToken ct)
    {
        var context = await campaigns.Get(input.CampaignId, ct, includeRecipients: false);
        var point = RequirePoint(context, input.PointId);
        var target = context.InKindTargets.SingleOrDefault(item => item.Id == input.BudgetItemId && item.AcceptsInKind)
            ?? throw new ApiException(400, "Hạng mục này không nhận hiện vật.");
        if (input.Quantity != decimal.Round(input.Quantity, 2)) throw new ApiException(400, "Số lượng có tối đa hai chữ số thập phân.");
        var donor = await accounts.Get(donorId, ct);
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{context.CampaignId:N}");
        await Acquire(gate, ct);
        await ValidateSchedule(context, point, input.ScheduledAt, Guid.Empty, ct);
        var now = DateTimeOffset.UtcNow;
        if (await db.InKindPledges.AnyAsync(row => row.CampaignId == context.CampaignId && row.DonorUserId == donorId &&
            row.BudgetItemId == target.Id && row.Status == "APPROVED" && row.ExpiresAt > now && row.ReceivedQuantity < row.Quantity, ct))
            throw new ApiException(409, "Bạn đã có lịch giao đang mở cho hạng mục này. Hãy đổi lịch trước khi tạo lịch mới.");
        var targetProgress = (await progress.Summary(context, ct)).InKindTargets.Single(item => item.BudgetItemId == target.Id);
        if (targetProgress.IsComplete || input.Quantity > targetProgress.AvailableToSchedule)
            throw new ApiException(409, "Số lượng vượt phần chỉ tiêu còn có thể hẹn giao.");
        var pledge = new InKindPledge
        {
            CampaignId = context.CampaignId, BudgetItemId = target.Id, DonorUserId = donorId,
            DonorName = donor.FullName, DonorEmail = donor.Email, CampaignTitle = context.CampaignTitle,
            TargetName = target.Name, Unit = target.Unit, Quantity = input.Quantity,
            Note = Normalize(input.Note), Status = "APPROVED", CreatedAt = now, ReviewedAt = now, PointId = point.Id,
            ScheduledAt = input.ScheduledAt, ExpiresAt = input.ScheduledAt.AddHours(2)
        };
        db.InKindPledges.Add(pledge);
        AddNotification(pledge, context, "SCHEDULED", now);
        await db.SaveChangesAsync(ct);
        return View(pledge, now);
    }

    public async Task<InKindPledgeView[]> Mine(Guid donorId, int page, CancellationToken ct)
    {
        var rows = await db.InKindPledges.AsNoTracking().Where(item => item.DonorUserId == donorId)
            .OrderByDescending(item => item.CreatedAt).ThenByDescending(item => item.Id).Skip((page - 1) * 20).Take(20).ToArrayAsync(ct);
        var now = DateTimeOffset.UtcNow;
        return rows.Select(row => View(row, now)).ToArray();
    }

    public async Task<InKindPledgeView> Mine(Guid donorId, Guid id, CancellationToken ct)
    {
        var row = await db.InKindPledges.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id && item.DonorUserId == donorId, ct)
            ?? throw new ApiException(404, "Không tìm thấy lịch giao hiện vật.");
        return View(row, DateTimeOffset.UtcNow);
    }

    public async Task<InKindPledgeView> ChangeSchedule(Guid id, Guid donorId, DateTimeOffset? newTime, CancellationToken ct)
    {
        var campaignId = await db.InKindPledges.Where(row => row.Id == id && row.DonorUserId == donorId)
            .Select(row => (Guid?)row.CampaignId).SingleOrDefaultAsync(ct)
            ?? throw new ApiException(404, "Không tìm thấy lịch giao hiện vật.");
        var context = await campaigns.Get(campaignId, ct, includeRecipients: false);
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{campaignId:N}");
        await Acquire(gate, ct);
        var row = await db.InKindPledges.SingleAsync(item => item.Id == id && item.DonorUserId == donorId, ct);
        var now = DateTimeOffset.UtcNow;
        if (newTime is null && row.Status == "CANCELLED") return View(row, now);
        if (row.Status is not ("PENDING" or "APPROVED") ||
            newTime is not null && (row.Status != "APPROVED" || row.ScheduledAt is null || row.ExpiresAt <= now))
            throw new ApiException(409, "Lịch giao này hiện không thể chỉnh sửa.");
        if (newTime is { } time)
        {
            var point = RequirePoint(context, row.PointId);
            await ValidateSchedule(context, point, time, row.Id, ct);
            row.ScheduledAt = time;
            row.ExpiresAt = time.AddHours(2);
            row.PointId = point.Id;
            row.Status = "APPROVED";
            AddNotification(row, context, "RESCHEDULED", now);
        }
        else
        {
            row.Status = "CANCELLED";
            AddNotification(row, context, "CANCELLED", now);
        }
        await db.SaveChangesAsync(ct);
        return View(row, now);
    }

    public async Task<InKindReceiptView> Receive(Guid campaignId, Guid actor, ReceiveInKindBatchRequest input, CancellationToken ct)
    {
        if (input.RequestId == Guid.Empty || input.Lines.Any(line => line.BudgetItemId == Guid.Empty || line.PledgeId == Guid.Empty ||
            line.Quantity <= 0 || line.Quantity != decimal.Round(line.Quantity, 2)))
            throw new ApiException(400, "Điền hạng mục và số lượng thực nhận hợp lệ.");
        var context = await campaigns.Get(campaignId, ct);
        var point = RequirePoint(context, input.PointId);
        if (!context.ManagerUserIds.Contains(actor) && !point.ReceiverUserIds.Contains(actor))
            throw new ApiException(403, "Bạn không được giao tiếp nhận tại điểm này.");
        var requestHash = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(input, Json)));
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{campaignId:N}");
        await Acquire(gate, ct);
        var existing = await db.InKindReceipts.AsNoTracking().Include(row => row.Lines)
            .SingleOrDefaultAsync(row => row.CampaignId == campaignId && row.RequestId == input.RequestId, ct);
        if (existing is not null)
        {
            if (existing.ReceiverUserId != actor || existing.RequestHash != requestHash)
                throw new ApiException(409, "Mã phiếu này đã được sử dụng.");
            return ReceiptView(existing);
        }

        await launch.EnsureReceiptsEditable(campaignId, ct);
        var now = DateTimeOffset.UtcNow;
        var targets = context.InKindTargets.Where(item => item.AcceptsInKind).ToDictionary(item => item.Id);
        var summary = await progress.Summary(context, ct);
        var actual = summary.InKindTargets.ToDictionary(item => item.BudgetItemId, item => item.ReceivedQuantity);
        var pledgeIds = input.Lines.Where(line => line.PledgeId.HasValue).Select(line => line.PledgeId!.Value).Distinct().ToArray();
        var pledges = await db.InKindPledges.Where(row => row.CampaignId == campaignId && pledgeIds.Contains(row.Id))
            .ToDictionaryAsync(row => row.Id, ct);
        var receipt = new InKindReceipt { CampaignId = campaignId, PointId = point.Id, ReceiverUserId = actor,
            RequestId = input.RequestId, RequestHash = requestHash, ReceivedAt = now };
        foreach (var line in input.Lines)
        {
            if (!targets.TryGetValue(line.BudgetItemId, out var target) || actual.GetValueOrDefault(target.Id) + line.Quantity > target.Quantity)
                throw new ApiException(409, "Số thực nhận vượt chỉ tiêu hoặc hạng mục không còn tiếp nhận.");
            actual[target.Id] = actual.GetValueOrDefault(target.Id) + line.Quantity;
            if (line.PledgeId is Guid id)
            {
                if (!pledges.TryGetValue(id, out var pledge) || pledge.BudgetItemId != target.Id ||
                    (pledge.PointId.HasValue && pledge.PointId != point.Id) || EffectiveStatus(pledge, now) != "APPROVED" ||
                    pledge.ReceivedQuantity + line.Quantity > pledge.Quantity)
                    throw new ApiException(409, "Lịch giao hoặc số lượng còn lại không phù hợp.");
                pledge.ReceivedQuantity += line.Quantity;
                if (pledge.ReceivedQuantity == pledge.Quantity)
                {
                    pledge.Status = "RECEIVED";
                    pledge.CompletedAt = now;
                }
                AddNotification(pledge, context, "RECEIVED", now, line.Quantity);
            }
            else if (summary.InKindTargets.Any(item => item.BudgetItemId == target.Id && item.SatisfiedByMoney))
                throw new ApiException(409, "Hạng mục này đã đủ mục tiêu bằng tiền.");

            receipt.Lines.Add(new InKindReceiptLine { BudgetItemId = line.BudgetItemId, PledgeId = line.PledgeId,
                Quantity = line.Quantity, Note = Normalize(line.Note) });
        }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.InKindReceipts.Add(receipt);
        await db.SaveChangesAsync(ct);
        await progress.CloseIfComplete(context, ct);
        await transaction.CommitAsync(ct);
        return ReceiptView(receipt);
    }

    public async Task<InKindReceiptView[]> RecentReceipts(Guid campaignId, Guid actor, int page, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct);
        var point = RequirePoint(context);
        if (!context.ManagerUserIds.Contains(actor) && !point.ReceiverUserIds.Contains(actor))
            throw new ApiException(403, "Bạn không có quyền xem phiếu tại điểm tiếp nhận này.");
        var rows = await db.InKindReceipts.AsNoTracking().Where(row => row.CampaignId == campaignId && row.PointId == point.Id)
            .OrderByDescending(row => row.ReceivedAt).ThenByDescending(row => row.Id).Skip((page - 1) * 20).Take(20)
            .Include(row => row.Lines).AsSplitQuery().ToArrayAsync(ct);
        var ids = rows.Select(row => row.Id).ToArray();
        var reversed = (await db.InKindReceipts.AsNoTracking().Where(row => row.CampaignId == campaignId &&
            row.ReversesReceiptId.HasValue && ids.Contains(row.ReversesReceiptId.Value))
            .Select(row => row.ReversesReceiptId!.Value).ToArrayAsync(ct)).ToHashSet();
        return rows.Select(row => ReceiptView(row) with { IsReversed = reversed.Contains(row.Id) }).ToArray();
    }

    public async Task<InKindReceiptView> Reverse(Guid campaignId, Guid receiptId, Guid actor, ReverseInKindReceiptRequest input, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct);
        if (!context.ManagerUserIds.Contains(actor)) throw new ApiException(403, "Chỉ quản lý được phân công có thể điều chỉnh phiếu.");
        var reason = input.Reason.Trim();
        if (input.RequestId == Guid.Empty || reason.Length < 5) throw new ApiException(400, "Cần mã yêu cầu và lý do điều chỉnh.");
        var hash = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new { receiptId, reason }, Json)));
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{campaignId:N}");
        await Acquire(gate, ct);
        var existing = await db.InKindReceipts.AsNoTracking().Include(row => row.Lines).SingleOrDefaultAsync(row =>
            row.CampaignId == campaignId && row.RequestId == input.RequestId, ct);
        if (existing is not null)
        {
            if (existing.ReceiverUserId != actor || existing.RequestHash != hash)
                throw new ApiException(409, "Mã phiếu này đã được sử dụng.");
            return ReceiptView(existing);
        }
        await launch.EnsureReceiptsEditable(campaignId, ct);
        var original = await db.InKindReceipts.AsNoTracking().Include(row => row.Lines)
            .SingleOrDefaultAsync(row => row.Id == receiptId && row.CampaignId == campaignId && row.ReversesReceiptId == null, ct)
            ?? throw new ApiException(404, "Không tìm thấy phiếu thực nhận đang tra cứu.");
        if (await db.InKindReceipts.AnyAsync(row => row.ReversesReceiptId == original.Id, ct))
            throw new ApiException(409, "Phiếu này đã được điều chỉnh.");
        var now = DateTimeOffset.UtcNow;
        var corrections = original.Lines.Where(line => line.PledgeId.HasValue).GroupBy(line => line.PledgeId!.Value)
            .ToDictionary(group => group.Key, group => group.Sum(line => line.Quantity));
        var pledgeIds = corrections.Keys.ToArray();
        var pledges = await db.InKindPledges.Where(row => row.CampaignId == campaignId && pledgeIds.Contains(row.Id)).ToArrayAsync(ct);
        if (pledges.Length != pledgeIds.Length || pledges.Any(row => row.ReceivedQuantity < corrections[row.Id]))
            throw new ApiException(409, "Số thực nhận hiện tại không khớp phiếu gốc.");
        foreach (var pledge in pledges)
        {
            pledge.ReceivedQuantity -= corrections[pledge.Id];
            if (pledge.Status == "RECEIVED")
            {
                pledge.Status = "APPROVED";
                pledge.CompletedAt = null;
            }
            AddNotification(pledge, context, "ADJUSTED", now, corrections[pledge.Id]);
        }
        var reversal = new InKindReceipt { CampaignId = campaignId, PointId = original.PointId, ReceiverUserId = actor,
            RequestId = input.RequestId, RequestHash = hash, ReceivedAt = now, ReversesReceiptId = original.Id, ReversalReason = reason,
            Lines = original.Lines.Select(line => new InKindReceiptLine { BudgetItemId = line.BudgetItemId,
                PledgeId = line.PledgeId, Quantity = line.Quantity }).ToList() };
        db.InKindReceipts.Add(reversal);
        await db.SaveChangesAsync(ct);
        return ReceiptView(reversal);
    }

    private async Task ValidateSchedule(CampaignDonationContext context, InKindReceivingPoint point, DateTimeOffset time,
        Guid currentId, CancellationToken ct)
    {
        var local = TimeZoneInfo.ConvertTime(time, TimeZoneInfo.FindSystemTimeZoneById(context.Timezone ?? "Asia/Ho_Chi_Minh"));
        var date = DateOnly.FromDateTime(local.DateTime);
        var clock = TimeOnly.FromDateTime(local.DateTime);
        if (time <= DateTimeOffset.UtcNow || context.OpensOn is { } from && date < from ||
            context.ClosesOn is { } until && date > until || point.OpensAt is { } open && clock < open ||
            point.ClosesAt is { } close && clock >= close)
            throw new ApiException(400, "Chọn thời điểm tương lai trong khung tiếp nhận của chiến dịch.");
        if (point.AppointmentsPerHour is not int maximum) return;
        var hour = new DateTimeOffset(local.Year, local.Month, local.Day, local.Hour, 0, 0, local.Offset);
        var hourEnd = hour.AddHours(1);
        var count = await db.InKindPledges.CountAsync(row => row.CampaignId == context.CampaignId && row.PointId == point.Id &&
            row.Id != currentId && row.ScheduledAt >= hour && row.ScheduledAt < hourEnd && row.Status == "APPROVED", ct);
        if (count >= maximum) throw new ApiException(409, "Khung giờ này đã đủ lịch giao. Hãy chọn giờ khác.");
    }

    internal void AddNotification(InKindPledge pledge, CampaignDonationContext context, string eventType,
        DateTimeOffset now, decimal receivedNow = 0)
    {
        var item = new InKindPledgeNotificationEvent(Guid.NewGuid(), pledge.Id, pledge.CampaignId, context.OrganizationId,
            pledge.DonorUserId, pledge.DonorName, pledge.TargetName, pledge.CampaignTitle, pledge.Quantity, pledge.Unit,
            pledge.ReceivedQuantity, receivedNow, eventType, context.ManagerUserIds, now);
        db.NotificationOutbox.Add(new DonationNotificationOutbox { Id = item.EventId, Route = "internal/notifications/in-kind-pledge",
            Payload = JsonSerializer.Serialize(item, Json), NextAttemptAt = now });
    }

    internal static InKindPledgeView View(InKindPledge pledge, DateTimeOffset now) => new(pledge.Id, pledge.BudgetItemId,
        pledge.DonorName, pledge.DonorEmail, pledge.TargetName, pledge.Quantity, pledge.ReceivedQuantity, pledge.Unit, pledge.Note,
        EffectiveStatus(pledge, now), pledge.CreatedAt, pledge.ReviewedAt, pledge.CompletedAt, pledge.CampaignId, pledge.PointId,
        pledge.ScheduledAt, pledge.ExpiresAt);

    internal static string EffectiveStatus(InKindPledge pledge, DateTimeOffset now) =>
        pledge.Status == "APPROVED" && pledge.ExpiresAt <= now ? "EXPIRED" : pledge.Status;

    private static InKindReceiptView ReceiptView(InKindReceipt row) => new(row.Id, row.CampaignId, row.PointId, row.ReceivedAt,
        row.Lines.Select(line => new InKindReceiptLineView(line.BudgetItemId, line.PledgeId,
            row.ReversesReceiptId is null ? line.Quantity : -line.Quantity, line.Note)).ToArray(), row.ReversesReceiptId, row.ReversalReason);

    private static InKindReceivingPoint RequirePoint(CampaignDonationContext context, Guid? pointId = null) =>
        context.ReceivingPoint is { } point && (!pointId.HasValue || point.Id == pointId)
            ? point : throw new ApiException(404, "Không tìm thấy điểm tiếp nhận hiện vật.");

    private static async Task Acquire(SqlSessionLock gate, CancellationToken ct)
    {
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đang cập nhật hỗ trợ của chiến dịch. Hãy thử lại.");
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
