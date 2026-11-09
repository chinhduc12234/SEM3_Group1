using CampaignService.Contracts;
using CampaignService.Data;

namespace CampaignService.Services;

public interface ICampaignApplication
{
    Task<CampaignView> Create(CampaignRequest r, Guid actor, CancellationToken ct);
    Task<CampaignView> Update(Guid id, CampaignRequest r, Guid actor, CancellationToken ct);
    Task<CampaignView> Submit(Guid id, string version, Guid actor, CancellationToken ct);
    Task<CampaignView> Review(Guid id, ReviewRequest r, Guid actor, CancellationToken ct);
    Task<object> List(Guid? org, Guid? actor, int page, string? search, string? cause, CancellationToken ct);
    Task<CampaignView> Detail(Guid id, Guid? actor, bool management, CancellationToken ct);
    Task<CampaignView> Upload(Guid id, string version, string kind, IFormFile file, Guid actor, CancellationToken ct, Guid? replaceId = null);
    Task<CampaignMedia> Download(Guid id, Guid mediaId, Guid? actor, CancellationToken ct);
}
