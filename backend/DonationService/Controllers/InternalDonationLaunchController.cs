using System.Security.Cryptography;
using System.Text;
using DonationService.Services;
using Microsoft.AspNetCore.Mvc;
using Shared;

namespace DonationService.Controllers;

[ApiController, Route("internal/launch/campaigns/{campaignId:guid}/goods")]
public sealed class InternalDonationLaunchController(DonationLaunchReadiness readiness, IConfiguration config) : ControllerBase
{
    [HttpGet]
    public Task<LaunchGoodsSnapshot> Snapshot(Guid campaignId, CancellationToken ct)
    {
        RequireInternal();
        return readiness.Snapshot(campaignId, ct);
    }

    [HttpPost("hold")]
    public async Task<IActionResult> Hold(Guid campaignId, HoldLaunchGoods request, CancellationToken ct)
    {
        RequireInternal();
        await readiness.Hold(campaignId, request, ct);
        return NoContent();
    }

    [HttpPost("release")]
    public async Task<IActionResult> Release(Guid campaignId, HoldLaunchGoods request, CancellationToken ct)
    {
        RequireInternal();
        await readiness.Release(campaignId, request.Token, ct);
        return NoContent();
    }

    private void RequireInternal()
    {
        var key = config["InternalApi:LaunchKey"];
        var given = Request.Headers["X-Launch-Key"].ToString();
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(given) ||
            !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)),
                SHA256.HashData(Encoding.UTF8.GetBytes(given))))
            throw new ApiException(401, "Yêu cầu nội bộ không hợp lệ.");
    }
}
