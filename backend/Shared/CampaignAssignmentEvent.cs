namespace Shared;

public sealed record CampaignAssignmentEvent(Guid EventId, Guid OrganizationId, Guid CampaignId, Guid UserId,
    string CampaignTitle, string[] Roles);
