using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Shared;

namespace DonationService.Contracts;

public readonly record struct DonationActor(Guid UserId)
{
    public static DonationActor From(ClaimsPrincipal principal) => Guid.TryParse(principal.FindFirstValue("sub"), out var id)
        ? new(id) : throw new ApiException(401, "Phiên đăng nhập không hợp lệ.");
}

public sealed record CreateDonationRequest(Guid CampaignId, Guid BudgetItemId,
    [Range(1, 1_000_000_000_000_000)] decimal Amount);
public sealed record SandboxOtpRequest([Required, RegularExpression("^\\d{6,20}$")] string PayerAccountNumber);
public sealed record ConfirmSandboxOtpRequest([Required, RegularExpression("^\\d{6}$")] string Otp);
public sealed record SandboxOtpIssued(Guid DonationId, string Reference, string PayerAccountLast4,
    DateTimeOffset ExpiresAt, string? TestOtp);
public sealed record DonationCreated(Guid Id, Guid CampaignId, Guid BudgetItemId, string CampaignTitle,
    string TargetName, decimal Amount, string Status, string PaymentMethod, string Reference, DateTimeOffset CreatedAt);
public sealed record DonationMine(Guid Id, Guid CampaignId, string CampaignTitle, string TargetName,
    decimal Amount, string Status, string Reference, DateTimeOffset CreatedAt, DateTimeOffset? ConfirmedAt);
public sealed record DonationManagerRow(Guid Id, string DonorName, string DonorEmail, string TargetName, string? PayerAccountLast4,
    decimal Amount, string Status, string Reference, DateTimeOffset CreatedAt, DateTimeOffset? ConfirmedAt);
public sealed record DonationTargetProgress(Guid BudgetItemId, string Name, decimal TargetAmount,
    decimal DonatedAmount, decimal RemainingAmount, bool IsComplete);
public sealed record DonationSummary(Guid CampaignId, decimal TargetAmount, decimal DonatedAmount,
    decimal RemainingAmount, int ConfirmedDonationCount, DonationTargetProgress[] Targets);
public sealed record DonationManagerView(DonationSummary Summary, int PendingCount, DonationManagerRow[] Donations);
public sealed record CampaignDonationTarget(Guid Id, string Name, string Category, decimal Amount);
public sealed record CampaignDonationContext(Guid CampaignId, Guid OrganizationId, string CampaignTitle,
    CampaignDonationTarget[] Targets, Guid[] FinanceUserIds);
public sealed record AccountDonationRecipient(string Email, string FullName);
