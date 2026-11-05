using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

// Service-only contract: never forwarded by the public gateway, never cached.
[ApiController, Route("internal/organizations")]
public sealed class InternalCampaignAccessController(OrganizationDb db, IConfiguration config) : ControllerBase
{
    [HttpGet("{id:guid}/campaign-access/{userId:guid}")]
    public async Task<IActionResult> Access(Guid id, Guid userId, CancellationToken ct)
    {
        var key = config["InternalApi:Key"];
        var supplied = Request.Headers["X-Internal-Key"].ToString();
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(supplied) ||
            !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)), SHA256.HashData(Encoding.UTF8.GetBytes(supplied))))
            return Unauthorized();
        var org = await db.Organizations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (org is null) return NotFound();
        var member = await db.Members.AsNoTracking().Include(x => x.Roles)
            .SingleOrDefaultAsync(x => x.OrganizationId == id && x.UserId == userId && x.IsActive, ct);
        return Ok(new { organizationId = id, organizationName = org.Profile.LegalName,
            isActive = org.Status == "ACTIVE", roles = member is null ? Array.Empty<string>() : WorkspaceAccess.Roles(member),
            surveyManagerUserId = member?.SurveyManagerUserId });
    }
}
