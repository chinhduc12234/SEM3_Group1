namespace Shared;

// Versioned integration contract. IDs are logical references, never cross-database foreign keys.
public sealed record OrganizationNotificationEvent(Guid EventId, Guid OrganizationId, Guid ApplicantUserId,
    string Action, string OrganizationName, DateTimeOffset OccurredAt);
