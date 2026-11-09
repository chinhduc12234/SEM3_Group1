using CampaignService.Data;

namespace CampaignService.Repositories;

public interface ICampaignRepository
{
    IQueryable<Campaign> Query { get; }
    Task<Campaign?> Find(Guid id, CancellationToken ct);
    void Add(Campaign campaign);
    Task Save(CancellationToken ct);
}
