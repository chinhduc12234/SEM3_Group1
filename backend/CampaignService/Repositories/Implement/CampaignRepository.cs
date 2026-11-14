using CampaignService.Data;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace CampaignService.Repositories;

public sealed class CampaignRepository(CampaignDb db) : ICampaignRepository
{
    public IQueryable<Campaign> Query => db.Campaigns;
    public Task<Campaign?> Find(Guid id, CancellationToken ct) => db.Campaigns.Include(x => x.Reviews).Include(x => x.Media).SingleOrDefaultAsync(x => x.Id == id, ct);
    public void Add(Campaign campaign) => db.Campaigns.Add(campaign);
    public void Remove(Campaign campaign) => db.Campaigns.Remove(campaign);
    public async Task Save(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(409, "Chiến dịch đã thay đổi. Vui lòng tải lại."); }
    }
}
