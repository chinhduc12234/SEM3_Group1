using System.Security.Claims;
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
    DonationAccountDirectory accounts, DonationSandboxPaymentService sandboxPayments) : ControllerBase
{
    private DonationActor Actor => DonationActor.From(User);

    [AllowAnonymous, HttpGet("campaigns/{campaignId:guid}/summary")]
    public async Task<DonationSummary> Summary(Guid campaignId, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct);
        return await BuildSummary(context, ct);
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
        if (!context.FinanceUserIds.Contains(Actor.UserId)) throw new ApiException(403, "Chỉ quản lý ngân sách được xem các khoản ủng hộ.");
        var summary = await BuildSummary(context, ct);
        var rows = await db.Donations.AsNoTracking().Where(x => x.CampaignId == campaignId)
            .OrderByDescending(x => x.CreatedAt).Take(500)
            .Select(x => new DonationManagerRow(x.Id, x.DonorName, x.DonorEmail, x.TargetName, x.PayerAccountLast4, x.Amount,
                x.Status, x.Reference, x.CreatedAt, x.ConfirmedAt)).ToArrayAsync(ct);
        var pending = await db.Donations.CountAsync(x => x.CampaignId == campaignId && x.Status != "CONFIRMED", ct);
        return new(summary, pending, rows);
    }

    private async Task<DonationSummary> BuildSummary(CampaignDonationContext context, CancellationToken ct)
    {
        var totals = await db.Donations.AsNoTracking().Where(x => x.CampaignId == context.CampaignId && x.Status == "CONFIRMED")
            .GroupBy(x => x.BudgetItemId).Select(group => new { BudgetItemId = group.Key, Amount = group.Sum(x => x.Amount), Count = group.Count() })
            .ToDictionaryAsync(x => x.BudgetItemId, ct);
        var targets = context.Targets.Select(target =>
        {
            var total = totals.GetValueOrDefault(target.Id);
            var donated = total?.Amount ?? 0m;
            return new DonationTargetProgress(target.Id, target.Name, target.Amount, donated,
                Math.Max(0m, target.Amount - donated), donated >= target.Amount);
        }).ToArray();
        var targetAmount = targets.Sum(x => x.TargetAmount);
        var donatedAmount = targets.Sum(x => x.DonatedAmount);
        return new(context.CampaignId, targetAmount, donatedAmount, Math.Max(0m, targetAmount - donatedAmount),
            totals.Values.Sum(x => x.Count), targets);
    }

    private static DonationCreated CreatedView(DonationRecord donation) => new(donation.Id, donation.CampaignId,
        donation.BudgetItemId, donation.CampaignTitle, donation.TargetName, donation.Amount,
        donation.Status, donation.PaymentMethod, donation.Reference, donation.CreatedAt);
}
