using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

// Service-only contract: never forwarded by the public gateway, never cached.
[ApiController, Route("internal/organizations")]
public sealed class InternalCampaignAccessController(OrganizationDb db, IConfiguration config, IdentityDirectory directory) : ControllerBase
{
    private bool Authorized()
    {
        var key = config["InternalApi:Key"];
        var supplied = Request.Headers["X-Internal-Key"].ToString();
        return !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(supplied) &&
            CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)), SHA256.HashData(Encoding.UTF8.GetBytes(supplied)));
    }

    [HttpGet("{id:guid}/campaign-access/{userId:guid}")]
    public async Task<IActionResult> Access(Guid id, Guid userId, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        var org = await db.Organizations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (org is null) return NotFound();
        var member = await db.Members.AsNoTracking().Include(x => x.Roles)
            .SingleOrDefaultAsync(x => x.OrganizationId == id && x.UserId == userId && x.IsActive, ct);
        return Ok(new { organizationId = id, organizationName = org.Profile.LegalName,
            isActive = org.Status == "ACTIVE", membershipId = member?.Id, roles = member is null ? Array.Empty<string>() : WorkspaceAccess.Roles(member) });
    }

    [HttpGet("{id:guid}/campaign-members")]
    public async Task<IActionResult> CampaignMembers(Guid id, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        if (!await db.Organizations.AnyAsync(x => x.Id == id && x.Status == "ACTIVE", ct)) return NotFound();
        var members = await db.Members.AsNoTracking().Include(x => x.Roles)
            .Where(x => x.OrganizationId == id && x.IsActive && x.UserId != null).ToListAsync(ct);
        var accounts = await directory.Read(members.Select(x => x.UserId!.Value), ct);
        return Ok(members.Where(x => accounts.GetValueOrDefault(x.UserId!.Value)?.IsActive == true)
            .Select(x => new { membershipId = x.Id, userId = x.UserId, fullName = x.PersonnelName ?? accounts[x.UserId!.Value].FullName,
                roles = WorkspaceAccess.Roles(x) }).OrderBy(x => x.fullName));
    }
}
