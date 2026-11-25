namespace CampaignService.Contracts;

public sealed record CampaignDonationContext(Guid CampaignId, Guid OrganizationId, string CampaignTitle,
    PublicFundingTarget[] Targets, PublicFundingTarget[] InKindTargets, Guid[] ManagerUserIds,
    DateOnly? OpensOn, DateOnly? ClosesOn, string? Timezone, DonationReceivingPoint? ReceivingPoint);

public sealed record DonationReceivingPoint(Guid Id, string Address, string ReceivingHours, string Contact,
    TimeOnly? OpensAt, TimeOnly? ClosesAt, int? AppointmentsPerHour, Guid[] ReceiverUserIds);
