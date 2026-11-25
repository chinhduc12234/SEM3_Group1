using System.Security.Cryptography;
using System.Text;
using CampaignService.Services;
using Microsoft.AspNetCore.Mvc;
using Shared;

namespace CampaignService.Controllers;

[ApiController, Route("internal/campaign-launch")]
public sealed class InternalCampaignLaunchController(ICampaignApplication service, IConfiguration configuration) : ControllerBase
{
    private void RequireInternal()
    {
        var key = configuration["InternalApi:LaunchKey"];
        var given = Request.Headers["X-Launch-Key"].ToString();
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(given) ||
            !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)),
                SHA256.HashData(Encoding.UTF8.GetBytes(given))))
            throw new ApiException(401, "Yêu cầu nội bộ không hợp lệ.");
    }

    [HttpGet("{id:guid}/context/{actor:guid}")]
    public Task<LaunchContext> Context(Guid id, Guid actor, CancellationToken ct)
    {
        RequireInternal();
        return service.LaunchContext(id, actor, ct);
    }

    [HttpPost("{id:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid id, LaunchConfirmCommand request, CancellationToken ct)
    {
        RequireInternal();
        await service.ConfirmLaunch(id, request, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/start")]
    public Task<CampaignStarted> Start(Guid id, LaunchStartCommand request, CancellationToken ct)
    {
        RequireInternal();
        return service.StartLaunch(id, request, ct);
    }
}
