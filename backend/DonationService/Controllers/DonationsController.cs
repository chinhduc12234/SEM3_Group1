using System.Security.Claims;
using System.Text.Json;
using DonationService.Contracts;
using DonationService.Data;
using DonationService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace DonationService.Controllers;

[ApiController, Route("api/donations")]
public sealed class DonationsController(DonationDb db, CampaignDonationClient campaigns,
    DonationAccountDirectory accounts, DonationSandboxPaymentService sandboxPayments,
    FundraisingProgressService progress) : ControllerBase
{
    private static readonly JsonSerializerOptions NotificationJson = new(JsonSerializerDefaults.Web);
    private DonationActor Actor => DonationActor.From(User);

    [AllowAnonymous, HttpGet("campaigns/{campaignId:guid}/summary")]
    public async Task<DonationSummary> Summary(Guid campaignId, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct);
        return await progress.Summary(context, ct);
    }

    [Authorize, HttpPost]
    public async Task<IActionResult> Create(CreateDonationRequest request, CancellationToken ct)
    {
        if (request.CampaignId == Guid.Empty || request.BudgetItemId == Guid.Empty || request.Amount <= 0 ||
            request.Amount != decimal.Truncate(request.Amount) || request.Amount > 1_000_000_000_000_000m)
            throw new ApiException(400, "Chọn khoản dự toán và nhập số tiền VND nguyên lớn hơn 0.");
        var context = await campaigns.Get(request.CampaignId, ct);
        var target = context.Targets.SingleOrDefault(x => x.Id == request.BudgetItemId)
            ?? throw new ApiException(400, "Khoản dự toán không thuộc mục tiêu gây quỹ công khai của chiến dịch.");
        var donor = await accounts.Get(Actor.UserId, ct);
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{context.CampaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đang ghi nhận hỗ trợ khác cho chiến dịch này; vui lòng thử lại.");
        var summary = await progress.Summary(context, ct);
        var targetProgress = summary.Targets.SingleOrDefault(x => x.BudgetItemId == target.Id);
        if (summary.IsClosed || targetProgress is null || targetProgress.IsComplete)
            throw new ApiException(409, "Mục tiêu này đã đủ; chiến dịch không nhận thêm khoản ủng hộ này.");
        var activePending = await db.Donations.Where(x => x.CampaignId == context.CampaignId && x.BudgetItemId == target.Id &&
            (x.Status == "PENDING" || x.Status == "OTP_PENDING") && x.CreatedAt > DateTimeOffset.UtcNow.AddMinutes(-15))
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        if (request.Amount > Math.Max(0m, targetProgress.RemainingAmount - activePending))
            throw new ApiException(409, "Số tiền vượt quá phần mục tiêu còn thiếu; hãy nhập số tiền nhỏ hơn.");
        var donation = new DonationRecord
        {
            CampaignId = context.CampaignId, BudgetItemId = target.Id, DonorUserId = Actor.UserId,
            DonorName = donor.FullName, DonorEmail = donor.Email, CampaignTitle = context.CampaignTitle,
            TargetName = target.Name, Amount = request.Amount, Status = "PENDING",
            PaymentMethod = "SIMULATED_QR", Reference = "GA-DON-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant()
        };
        db.Donations.Add(donation);
        await db.SaveChangesAsync(ct);
        return Created($"/api/donations/{donation.Id}", CreatedView(donation));
    }

    [Authorize, HttpPost("{id:guid}/sandbox/otp")]
    public Task<SandboxOtpIssued> IssueSandboxOtp(Guid id, SandboxOtpRequest request, CancellationToken ct) =>
        sandboxPayments.IssueOtp(id, Actor.UserId, request.PayerAccountNumber, ct);

    [Authorize, HttpPost("{id:guid}/sandbox/confirm")]
    public Task<DonationCreated> ConfirmSandboxPayment(Guid id, ConfirmSandboxOtpRequest request, CancellationToken ct) =>
        sandboxPayments.Confirm(id, Actor.UserId, request.Otp, ct);

    [Authorize, HttpGet("me")]
    public async Task<DonationMine[]> Mine(CancellationToken ct) => await db.Donations.AsNoTracking()
        .Where(x => x.DonorUserId == Actor.UserId).OrderByDescending(x => x.CreatedAt).Take(100)
        .Select(x => new DonationMine(x.Id, x.CampaignId, x.CampaignTitle, x.TargetName, x.Amount,
            x.Status, x.Reference, x.CreatedAt, x.ConfirmedAt)).ToArrayAsync(ct);

    [Authorize, HttpGet("manager/campaigns/{campaignId:guid}")]
    public async Task<DonationManagerView> Manager(Guid campaignId, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct);
        if (!context.ManagerUserIds.Contains(Actor.UserId)) throw new ApiException(403, "Chỉ quản lý chiến dịch hoặc quản lý ngân sách được xem các khoản ủng hộ.");
        var summary = await progress.Summary(context, ct);
        var rows = await db.Donations.AsNoTracking().Where(x => x.CampaignId == campaignId)
            .OrderByDescending(x => x.CreatedAt).Take(500)
            .Select(x => new DonationManagerRow(x.Id, x.DonorName, x.DonorEmail, x.TargetName, x.PayerAccountLast4, x.Amount,
                x.Status, x.Reference, x.CreatedAt, x.ConfirmedAt)).ToArrayAsync(ct);
        var pending = await db.Donations.CountAsync(x => x.CampaignId == campaignId && x.Status != "CONFIRMED", ct);
        return new(summary, pending, rows);
    }

    [Authorize, HttpPost("in-kind")]
    public async Task<IActionResult> CreateInKind(CreateInKindPledgeRequest request, CancellationToken ct)
    {
        if (request.CampaignId == Guid.Empty || request.BudgetItemId == Guid.Empty || request.Quantity <= 0 ||
            request.Quantity != decimal.Round(request.Quantity, 2))
            throw new ApiException(400, "Chọn món hiện vật và nhập số lượng hợp lệ.");
        var context = await campaigns.Get(request.CampaignId, ct);
        var target = context.InKindTargets.SingleOrDefault(x => x.Id == request.BudgetItemId && x.AcceptsInKind)
            ?? throw new ApiException(400, "Mục tiêu này không nhận hiện vật.");
        var donor = await accounts.Get(Actor.UserId, ct);
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{context.CampaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đang ghi nhận hỗ trợ khác cho chiến dịch này; vui lòng thử lại.");
        var summary = await progress.Summary(context, ct);
        var targetProgress = summary.InKindTargets.Single(x => x.BudgetItemId == target.Id);
        if (summary.IsClosed || targetProgress.IsComplete)
            throw new ApiException(409, "Mục tiêu hiện vật này đã đủ; không nhận thêm đăng ký.");
        if (request.Quantity > targetProgress.RemainingQuantity)
            throw new ApiException(409, "Số lượng vượt quá chỉ tiêu hiện còn trống.");
        var pledge = new InKindPledge
        {
            CampaignId = context.CampaignId, BudgetItemId = target.Id, DonorUserId = Actor.UserId,
            DonorName = donor.FullName, DonorEmail = donor.Email, CampaignTitle = context.CampaignTitle,
            TargetName = target.Name, Quantity = request.Quantity, Unit = target.Unit,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(), Status = "PENDING"
        };
        db.InKindPledges.Add(pledge);
        AddInKindNotification(pledge, context, "SUBMITTED");
        await db.SaveChangesAsync(ct);
        return Created($"/api/donations/in-kind/{pledge.Id}", InKindView(pledge));
    }

    [Authorize, HttpGet("manager/campaigns/{campaignId:guid}/in-kind")]
    public async Task<InKindManagerView> ManagerInKind(Guid campaignId, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct);
        if (!context.ManagerUserIds.Contains(Actor.UserId)) throw new ApiException(403, "Chỉ quản lý chiến dịch hoặc quản lý ngân sách được xem hiện vật.");
        var summary = await progress.Summary(context, ct);
        var pledges = await db.InKindPledges.AsNoTracking().Where(x => x.CampaignId == campaignId)
            .OrderByDescending(x => x.CreatedAt).Take(500).Select(x => new InKindPledgeView(x.Id, x.BudgetItemId,
                x.DonorName, x.DonorEmail, x.TargetName, x.Quantity, x.ReceivedQuantity, x.Unit, x.Note,
                x.Status, x.CreatedAt, x.ReviewedAt, x.CompletedAt)).ToArrayAsync(ct);
        return new(summary.InKindTargets, pledges);
    }

    [Authorize, HttpPost("in-kind/{id:guid}/review")]
    public async Task<InKindPledgeView> ReviewInKind(Guid id, ReviewInKindPledgeRequest request, CancellationToken ct)
    {
        var pledge = await db.InKindPledges.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Không tìm thấy đơn hiện vật.");
        var context = await campaigns.Get(pledge.CampaignId, ct);
        if (!context.ManagerUserIds.Contains(Actor.UserId)) throw new ApiException(403, "Chỉ quản lý chiến dịch hoặc quản lý ngân sách được duyệt hiện vật.");
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{context.CampaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đang cập nhật mục tiêu hỗ trợ; vui lòng thử lại.");
        if (pledge.Status != "PENDING") throw new ApiException(409, "Đơn này đã được xử lý.");
        if (request.Decision == "APPROVE")
        {
            var target = context.InKindTargets.SingleOrDefault(x => x.Id == pledge.BudgetItemId && x.AcceptsInKind)
                ?? throw new ApiException(409, "Mục tiêu hiện vật không còn được mở.");
            var committed = await db.InKindPledges.Where(x => x.CampaignId == pledge.CampaignId && x.BudgetItemId == pledge.BudgetItemId &&
                (x.Status == "APPROVED" || x.Status == "RECEIVED")).SumAsync(x => (decimal?)x.Quantity, ct) ?? 0m;
            if (committed + pledge.Quantity > target.Quantity) throw new ApiException(409, "Không thể duyệt: nhóm hiện vật đã đủ chỉ tiêu hoặc không còn đủ chỗ.");
            var currentSummary = await progress.Summary(context, ct);
            var targetProgress = currentSummary.InKindTargets.SingleOrDefault(x => x.BudgetItemId == pledge.BudgetItemId);
            if (currentSummary.IsClosed || targetProgress is null || targetProgress.IsComplete)
                throw new ApiException(409, "Khoản này đã đủ mục tiêu bằng tiền hoặc hiện vật; không thể duyệt thêm.");
            pledge.Status = "APPROVED";
        }
        else pledge.Status = "REJECTED";
        pledge.ReviewedBy = Actor.UserId;
        pledge.ReviewedAt = DateTimeOffset.UtcNow;
        AddInKindNotification(pledge, context, pledge.Status);
        await db.SaveChangesAsync(ct);
        await progress.CloseIfComplete(context, ct);
        return InKindView(pledge);
    }

    [Authorize, HttpPost("in-kind/{id:guid}/receive")]
    public async Task<InKindPledgeView> ReceiveInKind(Guid id, ReceiveInKindPledgeRequest request, CancellationToken ct)
    {
        var pledge = await db.InKindPledges.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Không tìm thấy đơn hiện vật.");
        var context = await campaigns.Get(pledge.CampaignId, ct);
        if (!context.ManagerUserIds.Contains(Actor.UserId)) throw new ApiException(403, "Chỉ quản lý chiến dịch hoặc quản lý ngân sách được xác nhận nhận hàng.");
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{context.CampaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đang cập nhật hỗ trợ của chiến dịch; vui lòng thử lại.");
        pledge = await db.InKindPledges.SingleAsync(x => x.Id == id, ct);
        if (pledge.Status != "APPROVED" || request.Quantity <= 0 || pledge.ReceivedQuantity + request.Quantity > pledge.Quantity)
            throw new ApiException(409, "Số lượng nhận phải nằm trong phần hiện vật đã duyệt và chưa nhận.");
        pledge.ReceivedQuantity += request.Quantity;
        if (pledge.ReceivedQuantity == pledge.Quantity)
        {
            pledge.Status = "RECEIVED";
            pledge.CompletedAt = DateTimeOffset.UtcNow;
        }
        AddInKindNotification(pledge, context, "RECEIVED", request.Quantity);
        await db.SaveChangesAsync(ct);
        return InKindView(pledge);
    }

    private void AddInKindNotification(InKindPledge pledge, CampaignDonationContext context,
        string eventType, decimal receivedNow = 0m)
    {
        var now = DateTimeOffset.UtcNow;
        var item = new InKindPledgeNotificationEvent(Guid.NewGuid(), pledge.Id, pledge.CampaignId,
            context.OrganizationId, pledge.DonorUserId, pledge.DonorName, pledge.TargetName,
            pledge.CampaignTitle, pledge.Quantity, pledge.Unit, pledge.ReceivedQuantity, receivedNow,
            eventType, context.ManagerUserIds, now);
        db.NotificationOutbox.Add(new DonationNotificationOutbox
        {
            Id = item.EventId,
            Route = "internal/notifications/in-kind-pledge",
            Payload = JsonSerializer.Serialize(item, NotificationJson),
            NextAttemptAt = now
        });
    }

    private static InKindPledgeView InKindView(InKindPledge pledge) => new(pledge.Id, pledge.BudgetItemId,
        pledge.DonorName, pledge.DonorEmail, pledge.TargetName, pledge.Quantity, pledge.ReceivedQuantity,
        pledge.Unit, pledge.Note, pledge.Status, pledge.CreatedAt, pledge.ReviewedAt, pledge.CompletedAt);

    private static DonationCreated CreatedView(DonationRecord donation) => new(donation.Id, donation.CampaignId,
        donation.BudgetItemId, donation.CampaignTitle, donation.TargetName, donation.Amount,
        donation.Status, donation.PaymentMethod, donation.Reference, donation.CreatedAt);
}
