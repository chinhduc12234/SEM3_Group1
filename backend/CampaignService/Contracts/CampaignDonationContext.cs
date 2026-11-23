namespace CampaignService.Contracts;

public sealed record CampaignDonationContext(Guid CampaignId, Guid OrganizationId, string CampaignTitle,
    PublicFundingTarget[] Targets, PublicFundingTarget[] InKindTargets, Guid[] ManagerUserIds);
