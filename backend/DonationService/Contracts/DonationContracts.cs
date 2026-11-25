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
    [Range(1, 1_000_000_000_000_000)] decimal Amount, Guid? RequestId = null, bool PublishDonorName = false);
public sealed record SandboxOtpRequest([Required, RegularExpression("^\\d{6,20}$")] string PayerAccountNumber);
public sealed record ConfirmSandboxOtpRequest([Required, RegularExpression("^\\d{6}$")] string Otp);
public sealed record SandboxOtpIssued(Guid DonationId, string Reference, string PayerAccountLast4,
    DateTimeOffset ExpiresAt, string? TestOtp);
public sealed record DonationCreated(Guid Id, Guid CampaignId, Guid BudgetItemId, string CampaignTitle,
    string TargetName, decimal Amount, string Status, string PaymentMethod, string Reference, DateTimeOffset CreatedAt,
    DateTimeOffset? ConfirmedAt, DateTimeOffset ExpiresAt);
public sealed record DonationMine(Guid Id, Guid CampaignId, string CampaignTitle, string TargetName,
    decimal Amount, string Status, string Reference, DateTimeOffset CreatedAt, DateTimeOffset? ConfirmedAt,
    DateTimeOffset ExpiresAt, string PaymentMethod);
public sealed record DonationManagerRow(Guid Id, string DonorName, string DonorEmail, string TargetName, string? PayerAccountLast4,
    decimal Amount, string Status, string Reference, DateTimeOffset CreatedAt, DateTimeOffset? ConfirmedAt);
public sealed record DonationTargetProgress(Guid BudgetItemId, string Name, decimal TargetAmount,
    decimal DonatedAmount, decimal RemainingAmount, bool IsComplete, bool SatisfiedByInKind);
public sealed record DonationSummary(Guid CampaignId, decimal TargetAmount, decimal DonatedAmount,
    decimal RemainingAmount, int ConfirmedDonationCount, DonationTargetProgress[] Targets,
    InKindTargetProgress[] InKindTargets, bool IsClosed, string MoneyAvailability = "OPEN");
public sealed record InKindTargetProgress(Guid BudgetItemId, string Name, decimal TargetQuantity, string Unit,
    decimal ReceivedQuantity, decimal ReservedQuantity, decimal RemainingQuantity, bool IsComplete, bool SatisfiedByMoney)
{
    public decimal AvailableToSchedule => Math.Max(0, RemainingQuantity - ReservedQuantity);
}
public sealed record CreateInKindPledgeRequest(Guid CampaignId, Guid BudgetItemId,
    [Range(typeof(decimal), "1", "1000000")] decimal Quantity,
    [MaxLength(1000)] string? Note);
public sealed record ReviewInKindPledgeRequest([Required, RegularExpression("^(APPROVE|REJECT)$")] string Decision,
    [MaxLength(1000)] string? Note);
public sealed record ReceiveInKindPledgeRequest([Range(typeof(decimal), "0.01", "1000000")] decimal Quantity, Guid? RequestId = null);
public sealed record ScheduleInKindRequest(Guid CampaignId, Guid BudgetItemId, Guid PointId, DateTimeOffset ScheduledAt,
    [Range(typeof(decimal), "1", "1000000")] decimal Quantity, [MaxLength(1000)] string? Note);
public sealed record RescheduleInKindRequest(DateTimeOffset ScheduledAt);
public sealed record ReceiveInKindBatchRequest(Guid RequestId, Guid PointId,
    [Required, MinLength(1), MaxLength(100)] ReceiveInKindLineRequest[] Lines);
public sealed record ReceiveInKindLineRequest(Guid BudgetItemId, Guid? PledgeId,
    [Range(typeof(decimal), "0.01", "1000000")] decimal Quantity, [MaxLength(500)] string? Note);
public sealed record ReverseInKindReceiptRequest(Guid RequestId, [Required, StringLength(1000, MinimumLength = 5)] string Reason);
public sealed record InKindReceiptView(Guid Id, Guid CampaignId, Guid PointId, DateTimeOffset ReceivedAt, InKindReceiptLineView[] Lines,
    Guid? ReversesReceiptId = null, string? ReversalReason = null, bool IsReversed = false);
public sealed record InKindReceiptLineView(Guid BudgetItemId, Guid? PledgeId, decimal Quantity, string? Note);
public sealed record PublicInKindPoint(Guid Id, string Address, string ReceivingHours, string Contact,
    TimeOnly? OpensAt, TimeOnly? ClosesAt, int? AppointmentsPerHour, DateOnly? OpensOn, DateOnly? ClosesOn, string? Timezone);
public sealed record InKindPledgeView(Guid Id, Guid BudgetItemId, string DonorName, string DonorEmail,
    string TargetName, decimal Quantity, decimal ReceivedQuantity, string Unit, string? Note,
    string Status, DateTimeOffset CreatedAt, DateTimeOffset? ReviewedAt, DateTimeOffset? CompletedAt,
    Guid CampaignId = default, Guid? PointId = null, DateTimeOffset? ScheduledAt = null, DateTimeOffset? ExpiresAt = null);
public sealed record InKindManagerView(InKindTargetProgress[] Targets, InKindPledgeView[] Pledges);
public sealed record DonationManagerView(DonationSummary Summary, int PendingCount, DonationManagerRow[] Donations,
    int Page, int PageSize, int TotalCount);
public sealed record PublicDonationRow(string? DonorName, string TargetName, decimal Amount, DateTimeOffset? ConfirmedAt, string PaymentMethod);
public sealed record CampaignDonationTarget(Guid Id, string Name, string Category, decimal Amount);
public sealed record CampaignInKindTarget(Guid Id, string Name, string Category, decimal Amount,
    decimal Quantity, string Unit, bool AcceptsInKind);
public sealed record CampaignDonationContext(Guid CampaignId, Guid OrganizationId, string CampaignTitle,
    CampaignDonationTarget[] Targets, CampaignInKindTarget[] InKindTargets, Guid[] ManagerUserIds,
    DateOnly? OpensOn = null, DateOnly? ClosesOn = null, string? Timezone = null, InKindReceivingPoint? ReceivingPoint = null);
public sealed record InKindReceivingPoint(Guid Id, string Address, string ReceivingHours, string Contact,
    TimeOnly? OpensAt, TimeOnly? ClosesAt, int? AppointmentsPerHour, Guid[] ReceiverUserIds);
public sealed record AccountDonationRecipient(string Email, string FullName);
