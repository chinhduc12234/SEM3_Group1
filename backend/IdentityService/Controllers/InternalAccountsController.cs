using System.Security.Cryptography;
using System.Text;
using System.ComponentModel.DataAnnotations;
using IdentityService.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Controllers;

// Not routed through the gateway. Only the organization service receives this credential.
[ApiController, Route("internal/accounts")]
public sealed class InternalAccountsController(IdentityDb db, IConfiguration configuration) : ControllerBase
{
    [HttpGet("{id:guid}/notification-recipient")]
    public async Task<IActionResult> Recipient(Guid id, CancellationToken cancellationToken)
    {
        if (!AuthorizedService()) return Unauthorized();
        var account = await db.Users.AsNoTracking().Where(x => x.Id == id && x.IsActive)
            .Select(x => new { x.Email, x.FullName }).SingleOrDefaultAsync(cancellationToken);
        return account is null ? NotFound() : Ok(account);
    }

    public sealed record LookupRequest([Required, EmailAddress, MaxLength(256)] string Email);
    [HttpPost("lookup")]
    public async Task<IActionResult> Lookup(LookupRequest request, CancellationToken cancellationToken)
    {
        if (!AuthorizedService()) return Unauthorized();
        var normalized = request.Email.Trim().ToUpperInvariant();
        var account = await db.Users.AsNoTracking().Where(x => x.NormalizedEmail == normalized && x.IsActive)
            .Select(x => new { x.Id, x.Email, x.FullName,
                IsAdmin = db.UserRoles.Any(ur => ur.UserId == x.Id && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == "ADMIN")) })
            .SingleOrDefaultAsync(cancellationToken);
        return account is null ? NotFound() : Ok(account);
    }

    [HttpPost("directory")]
    public async Task<IActionResult> Directory([FromBody, MaxLength(100)] Guid[] ids, CancellationToken cancellationToken)
    {
        if (!AuthorizedService()) return Unauthorized();
        return Ok(await db.Users.AsNoTracking().Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.FullName, x.Email, x.IsActive }).ToListAsync(cancellationToken));
    }

    private bool AuthorizedService()
    {
        var configured = configuration["InternalApi:Key"];
        var supplied = Request.Headers["X-Internal-Key"].ToString();
        if (string.IsNullOrWhiteSpace(configured) || string.IsNullOrWhiteSpace(supplied) ||
            !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(configured)),
                SHA256.HashData(Encoding.UTF8.GetBytes(supplied)))) return false;
        return true;
    }
}
