using System.Security.Claims;
using CampaignLaunchService.Contracts;
using CampaignLaunchService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared;

namespace CampaignLaunchService.Controllers;

[ApiController, Authorize, Route("api/launch/campaigns/{campaignId:guid}")]
public sealed class CampaignLaunchController(LaunchReadinessService service) : ControllerBase
{
    private Guid Actor => Guid.TryParse(User.FindFirstValue("sub"), out var id)
        ? id : throw new ApiException(401, "Phiên đăng nhập không hợp lệ.");

    [HttpGet]
    public Task<LaunchReadiness> Read(Guid campaignId, CancellationToken ct) => service.Read(campaignId, Actor, ct);

    [HttpPost("confirmations/{section}")]
    public async Task<IActionResult> Confirm(Guid campaignId, string section, ReadinessRequest request, CancellationToken ct)
    {
        await service.Confirm(campaignId, Actor, section, request, ct);
        return NoContent();
    }

    [HttpPost("start")]
    public Task<CampaignStarted> Start(Guid campaignId, ReadinessRequest request, CancellationToken ct) =>
        service.Start(campaignId, Actor, request, ct);
}
