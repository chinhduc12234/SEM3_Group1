using CampaignService.Contracts;
using CampaignService.Data;

namespace CampaignService.Services;

public interface IOrganizationAccess
{
    Task<OrganizationPermission> Require(Guid org, Guid actor, string[] allowed, CancellationToken ct);
    Task<CampaignMember[]> Members(Guid org, CancellationToken ct);
}
