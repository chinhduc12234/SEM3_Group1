using System.Security.Cryptography;
using System.Text;
using CampaignService.Contracts;
using CampaignService.Services;
using Microsoft.AspNetCore.Mvc;

namespace CampaignService.Controllers;

[ApiController, Route("internal/campaigns")]
public sealed class InternalDonationController(ICampaignApplication service, IConfiguration configuration) : ControllerBase
{
    [HttpGet("{id:guid}/donation-context")]
    public async Task<IActionResult> Context(Guid id, CancellationToken ct, bool includeRecipients = true)
    {
        var expected = configuration["InternalApi:Key"];
        var supplied = Request.Headers["X-Internal-Key"].ToString();
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(supplied) ||
            !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(expected)),
                SHA256.HashData(Encoding.UTF8.GetBytes(supplied)))) return Unauthorized();
        return Ok(await service.DonationContext(id, includeRecipients, ct));
    }
}
