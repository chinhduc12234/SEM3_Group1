using VolunteerService.Contracts;

namespace VolunteerService.Services;

public interface ICampaignTaskAccessClient
{
    Task<CampaignTaskAccessResult> Check(Guid campaignId, Guid activityId, Guid groupId,
        Guid userId, CancellationToken ct);
}
