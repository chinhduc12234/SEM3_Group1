using System.Security.Cryptography;
using System.Text;
using System.ComponentModel.DataAnnotations;
using IdentityService.Services;
using Microsoft.AspNetCore.Mvc;

namespace IdentityService.Controllers;

// Not routed through the gateway. Only the organization service receives this credential.
[ApiController, Route("internal/accounts")]
public sealed class InternalAccountsController(AccountDirectory directory, IConfiguration configuration) : ControllerBase
{
    [HttpGet("{id:guid}/notification-recipient")]
    public async Task<IActionResult> Recipient(Guid id, CancellationToken cancellationToken)
    {
        if (!AuthorizedService()) return Unauthorized();
        var account = await directory.Recipient(id, cancellationToken);
        return account is null ? NotFound() : Ok(account);
    }

    public sealed record LookupRequest([Required, EmailAddress, MaxLength(256)] string Email);
    [HttpPost("lookup")]
    public async Task<IActionResult> Lookup(LookupRequest request, CancellationToken cancellationToken)
    {
        if (!AuthorizedService()) return Unauthorized();
        var account = await directory.Lookup(request.Email, cancellationToken);
        return account is null ? NotFound() : Ok(account);
    }

    [HttpPost("directory")]
    public async Task<IActionResult> Directory([FromBody, MaxLength(100)] Guid[] ids, CancellationToken cancellationToken)
    {
        if (!AuthorizedService()) return Unauthorized();
        var account = await directory.Directory(ids, cancellationToken);
        return Ok(account);
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
