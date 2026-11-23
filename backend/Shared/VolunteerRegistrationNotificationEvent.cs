namespace Shared;

// Internal integration event. VolunteerService persists it to its outbox before returning 201.
public sealed record VolunteerRegistrationNotificationEvent(Guid EventId, Guid CampaignId, Guid RegistrationId,
    string VolunteerName, DateTimeOffset SubmittedAt);

public sealed record VolunteerReviewRecipients(Guid CampaignId, Guid OrganizationId, string CampaignTitle,
    Guid[] UserIds);
