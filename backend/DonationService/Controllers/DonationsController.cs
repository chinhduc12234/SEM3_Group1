using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;
using System.Text.Json;
using DonationService.Contracts;
using DonationService.Data;
using DonationService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace DonationService.Controllers;

[ApiController, Route("api/donations")]
public sealed class DonationsController(DonationDb db, CampaignDonationClient campaigns,
    DonationAccountDirectory accounts, DonationSandboxPaymentService sandboxPayments,
    FundraisingProgressService progress, InKindIntakeService intake) : ControllerBase
{
    private static readonly JsonSerializerOptions NotificationJson = new(JsonSerializerDefaults.Web);
    private DonationActor Actor => DonationActor.From(User);

    [AllowAnonymous, HttpGet("campaigns/{campaignId:guid}/summary")]
    public async Task<DonationSummary> Summary(Guid campaignId, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct, includeRecipients: false);
        var summary = await progress.Summary(context, ct);
        return summary with { MoneyAvailability = sandboxPayments.Availability(context, summary, DateTimeOffset.UtcNow) };
    }

    [Authorize, HttpPost, EnableRateLimiting("sandbox-create")]
    public async Task<IActionResult> Create(CreateDonationRequest request, CancellationToken ct)
    {
        var donation = await sandboxPayments.Create(Actor.UserId, request, ct);
        return Created($"/api/donations/{donation.Id}", donation);
    }

    [Authorize, HttpGet("{id:guid}")]
    public Task<DonationCreated> Resume(Guid id, CancellationToken ct) => sandboxPayments.Resume(id, Actor.UserId, ct);

    [Authorize, HttpPost("{id:guid}/sandbox/otp"), EnableRateLimiting("sandbox-otp")]
    public Task<SandboxOtpIssued> IssueSandboxOtp(Guid id, SandboxOtpRequest request, CancellationToken ct) =>
        sandboxPayments.IssueOtp(id, Actor.UserId, request.PayerAccountNumber, ct);

    [Authorize, HttpPost("{id:guid}/sandbox/confirm"), EnableRateLimiting("sandbox-confirm")]
    public Task<DonationCreated> ConfirmSandboxPayment(Guid id, ConfirmSandboxOtpRequest request, CancellationToken ct) =>
        sandboxPayments.Confirm(id, Actor.UserId, request.Otp, ct);

    [Authorize, HttpGet("me")]
    public Task<DonationMine[]> Mine([Range(1, 10_000)] int page = 1, CancellationToken ct = default)
    {
        const int holdMinutes = DonationSandboxPaymentService.HoldMinutes;
        var cutoff = DateTimeOffset.UtcNow.AddMinutes(-holdMinutes);
        return db.Donations.AsNoTracking().Where(x => x.DonorUserId == Actor.UserId)
            .OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip((page - 1) * 20).Take(20)
            .Select(x => new DonationMine(x.Id, x.CampaignId, x.CampaignTitle, x.TargetName, x.Amount,
                (x.Status == "PENDING" || x.Status == "OTP_PENDING") && x.CreatedAt <= cutoff ? "EXPIRED" : x.Status,
                x.Reference, x.CreatedAt, x.ConfirmedAt, x.CreatedAt.AddMinutes(holdMinutes), x.PaymentMethod)).ToArrayAsync(ct);
    }

    [AllowAnonymous, HttpGet("campaigns/{campaignId:guid}/disclosure")]
    public async Task<PublicDonationRow[]> Disclosure(Guid campaignId, [Range(1, 10_000)] int page = 1, CancellationToken ct = default)
    {
        await campaigns.Get(campaignId, ct, includeRecipients: false);
        return await db.Donations.AsNoTracking().Where(row => row.CampaignId == campaignId && row.Status == "CONFIRMED")
            .OrderByDescending(row => row.ConfirmedAt).ThenByDescending(row => row.Id).Skip((page - 1) * 20).Take(20)
            .Select(row => new PublicDonationRow(row.PublishDonorName ? row.DonorName : null, row.TargetName,
                row.Amount, row.ConfirmedAt, row.PaymentMethod)).ToArrayAsync(ct);
    }

    [Authorize, HttpGet("manager/campaigns/{campaignId:guid}")]
    public async Task<DonationManagerView> Manager(Guid campaignId,
        [Range(1, 100_000)] int page = 1, [Range(1, 100)] int pageSize = 50,
        [RegularExpression("^(CONFIRMED|PENDING|OTP_PENDING|EXPIRED)$")] string? status = null, Guid? budgetItemId = null,
        [MaxLength(40)] string? reference = null, DateTimeOffset? from = null, DateTimeOffset? to = null,
        CancellationToken ct = default)
    {
        var context = await campaigns.Get(campaignId, ct);
        if (!context.ManagerUserIds.Contains(Actor.UserId)) throw new ApiException(403, "Chỉ quản lý chiến dịch hoặc quản lý ngân sách được xem các khoản ủng hộ.");
        var summary = await progress.Summary(context, ct);
        var cutoff = DateTimeOffset.UtcNow.AddMinutes(-DonationSandboxPaymentService.HoldMinutes);
        var records = db.Donations.AsNoTracking().Where(x => x.CampaignId == campaignId);
        var pending = await records.CountAsync(x => (x.Status == "PENDING" || x.Status == "OTP_PENDING") && x.CreatedAt > cutoff, ct);
        if (status == "EXPIRED") records = records.Where(x => (x.Status == "PENDING" || x.Status == "OTP_PENDING") && x.CreatedAt <= cutoff);
        else if (status is "PENDING" or "OTP_PENDING") records = records.Where(x => x.Status == status && x.CreatedAt > cutoff);
        else if (status is not null) records = records.Where(x => x.Status == status);
        if (budgetItemId is Guid itemId) records = records.Where(x => x.BudgetItemId == itemId);
        if (!string.IsNullOrWhiteSpace(reference)) records = records.Where(x => x.Reference == reference.Trim());
        if (from is { } start) records = records.Where(x => x.CreatedAt >= start);
        if (to is { } end) records = records.Where(x => x.CreatedAt < end);
        var total = await records.CountAsync(ct);
        page = Math.Min(page, Math.Max(1, (int)Math.Ceiling((double)total / pageSize)));
        var rows = await records.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new DonationManagerRow(x.Id, x.DonorName, x.DonorEmail, x.TargetName, x.PayerAccountLast4, x.Amount,
                (x.Status == "PENDING" || x.Status == "OTP_PENDING") && x.CreatedAt <= cutoff ? "EXPIRED" : x.Status,
                x.Reference, x.CreatedAt, x.ConfirmedAt)).ToArrayAsync(ct);
        return new(summary, pending, rows, page, pageSize, total);
    }

    [Authorize, HttpGet("manager/campaigns/{campaignId:guid}/disclosure.csv")]
    public async Task Export(Guid campaignId, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct);
        if (!context.ManagerUserIds.Contains(Actor.UserId)) throw new ApiException(403, "Bạn không có quyền xuất kê khai.");
        if (from.HasValue && to.HasValue && from >= to) throw new ApiException(400, "Khoảng thời gian kê khai không hợp lệ.");
        var rows = db.Donations.AsNoTracking().Where(row => row.CampaignId == campaignId && row.Status == "CONFIRMED");
        if (from is { } start) rows = rows.Where(row => row.ConfirmedAt >= start);
        if (to is { } end) rows = rows.Where(row => row.ConfirmedAt < end);
        Response.ContentType = "text/csv; charset=utf-8";
        Response.Headers.ContentDisposition = $"attachment; filename=\"donations-{campaignId:N}.csv\"";
        Response.Headers.CacheControl = "no-store";
        await using var csv = new StreamWriter(Response.Body, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true), leaveOpen: true) { NewLine = "\r\n" };
        await csv.WriteLineAsync("reference,donor_name,donor_email,target,amount_vnd,payment_method,confirmed_at".AsMemory(), ct);
        await foreach (var row in rows.OrderByDescending(row => row.ConfirmedAt).ThenBy(row => row.Id)
            .Select(row => new { row.Reference, row.DonorName, row.DonorEmail, row.TargetName, row.Amount, row.PaymentMethod, row.ConfirmedAt })
            .AsAsyncEnumerable().WithCancellation(ct))
        {
            var record = string.Join(",", CsvCell(row.Reference), CsvCell(row.DonorName), CsvCell(row.DonorEmail),
                CsvCell(row.TargetName), row.Amount.ToString(CultureInfo.InvariantCulture), CsvCell(row.PaymentMethod),
                row.ConfirmedAt?.ToString("O", CultureInfo.InvariantCulture));
            await csv.WriteLineAsync(record.AsMemory(), ct);
        }
        await csv.FlushAsync(ct);
    }

    private static string CsvCell(string value)
    {
        var text = value.TrimStart();
        if (text.Length > 0 && text[0] is '=' or '+' or '-' or '@') value = "'" + value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
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
        if (request.Quantity > targetProgress.AvailableToSchedule)
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
            .OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Take(500).ToArrayAsync(ct);
        var now = DateTimeOffset.UtcNow;
        return new(summary.InKindTargets, pledges.Select(row => InKindIntakeService.View(row, now)).ToArray());
    }

    [Authorize, HttpPost("in-kind/{id:guid}/review")]
    public async Task<InKindPledgeView> ReviewInKind(Guid id, ReviewInKindPledgeRequest request, CancellationToken ct)
    {
        var located = await db.InKindPledges.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Không tìm thấy đơn hiện vật.");
        var context = await campaigns.Get(located.CampaignId, ct);
        if (!context.ManagerUserIds.Contains(Actor.UserId)) throw new ApiException(403, "Chỉ quản lý chiến dịch hoặc quản lý ngân sách được duyệt hiện vật.");
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{context.CampaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đang cập nhật mục tiêu hỗ trợ; vui lòng thử lại.");
        var pledge = await db.InKindPledges.SingleAsync(x => x.Id == id, ct);
        if (pledge.Status != "PENDING") throw new ApiException(409, "Đơn này đã được xử lý.");
        if (request.Decision == "APPROVE")
        {
            var target = context.InKindTargets.SingleOrDefault(x => x.Id == pledge.BudgetItemId && x.AcceptsInKind)
                ?? throw new ApiException(409, "Mục tiêu hiện vật không còn được mở.");
            var currentSummary = await progress.Summary(context, ct);
            var targetProgress = currentSummary.InKindTargets.SingleOrDefault(x => x.BudgetItemId == pledge.BudgetItemId);
            if (targetProgress is null || targetProgress.IsComplete || pledge.Quantity > targetProgress.AvailableToSchedule)
                throw new ApiException(409, "Khoản này đã đủ mục tiêu bằng tiền hoặc hiện vật; không thể duyệt thêm.");
            pledge.Status = "APPROVED";
            pledge.ExpiresAt = DateTimeOffset.UtcNow.AddDays(7);
        }
        else pledge.Status = "REJECTED";
        pledge.ReviewedBy = Actor.UserId;
        pledge.ReviewedAt = DateTimeOffset.UtcNow;
        AddInKindNotification(pledge, context, pledge.Status);
        await db.SaveChangesAsync(ct);
        return InKindView(pledge);
    }

    [Authorize, HttpPost("in-kind/{id:guid}/receive")]
    public async Task<InKindPledgeView> ReceiveInKind(Guid id, ReceiveInKindPledgeRequest request, CancellationToken ct)
    {
        var pledge = await db.InKindPledges.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Không tìm thấy đơn hiện vật.");
        await intake.Receive(pledge.CampaignId, Actor.UserId, new(request.RequestId ?? Guid.NewGuid(),
            pledge.PointId ?? pledge.CampaignId, [new(pledge.BudgetItemId, pledge.Id, request.Quantity, null)]), ct);
        return InKindIntakeService.View(await db.InKindPledges.AsNoTracking().SingleAsync(x => x.Id == id, ct), DateTimeOffset.UtcNow);
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

}
