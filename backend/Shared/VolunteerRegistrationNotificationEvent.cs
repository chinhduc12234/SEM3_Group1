namespace Shared;

// Internal integration event. VolunteerService persists it to its outbox before returning 201.
public sealed record VolunteerRegistrationNotificationEvent(Guid EventId, Guid CampaignId, Guid RegistrationId,
    string VolunteerName, DateTimeOffset SubmittedAt);

public sealed record VolunteerReviewRecipients(Guid CampaignId, Guid OrganizationId, string CampaignTitle,
    Guid[] UserIds);

public sealed record DonationConfirmedNotificationEvent(Guid EventId, Guid DonationId, Guid CampaignId,
    Guid OrganizationId, Guid DonorUserId, string DonorName, decimal Amount, string TargetName,
    string CampaignTitle, Guid[] FinanceUserIds, DateTimeOffset ConfirmedAt);

public sealed record FundraisingGoalReachedNotificationEvent(Guid EventId, Guid CampaignId, Guid OrganizationId,
    string CampaignTitle, Guid[] ManagerUserIds, DateTimeOffset ClosedAt);

public sealed record InKindPledgeNotificationEvent(Guid EventId, Guid PledgeId, Guid CampaignId,
    Guid OrganizationId, Guid DonorUserId, string DonorName, string TargetName, string CampaignTitle,
    decimal Quantity, string Unit, decimal ReceivedQuantity, decimal ReceivedNow, string EventType,
    Guid[] ManagerUserIds, DateTimeOffset OccurredAt);
