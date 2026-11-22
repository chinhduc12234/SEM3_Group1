using VolunteerService.Contracts;

namespace VolunteerService.Services;

public interface ICampaignOpeningsClient
{
    Task<CampaignVolunteerOpenings?> Get(Guid campaignId, CancellationToken ct);
}
