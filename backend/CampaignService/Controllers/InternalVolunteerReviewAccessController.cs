using System.Security.Cryptography;
using System.Text;
using CampaignService.Data;
using CampaignService.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CampaignService.Controllers;

// Service-only authorization check. The public gateway blocks /internal routes.
[ApiController, Route("internal/campaigns")]
public sealed class InternalVolunteerReviewAccessController(CampaignDb db, IConfiguration config,
    IOrganizationAccess access) : ControllerBase
{
    private bool Authorized()
    {
        var key = config["InternalApi:Key"];
        var supplied = Request.Headers["X-Internal-Key"].ToString();
        return !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(supplied) &&
            CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)),
                SHA256.HashData(Encoding.UTF8.GetBytes(supplied)));
    }

    [HttpGet("{campaignId:guid}/volunteer-review-access/{userId:guid}")]
    public async Task<IActionResult> ReviewAccess(Guid campaignId, Guid userId, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        var campaign = await db.Campaigns.AsNoTracking().Where(x => x.Id == campaignId)
            .Select(x => new { x.OrganizationId }).SingleOrDefaultAsync(ct);
        if (campaign is null) return NotFound();
        var permission = await access.Require(campaign.OrganizationId, userId, ["VOLUNTEER_COORDINATOR"], ct);
        var canReview = await db.Campaigns.AsNoTracking().Where(x => x.Id == campaignId)
            .SelectMany(x => x.Assignments).AnyAsync(x =>
                x.UserId == userId && x.MembershipId == permission.MembershipId &&
                x.Role == "VOLUNTEER_COORDINATOR" && x.RevokedAt == null, ct);
        return Ok(new { canReview });
    }
}
