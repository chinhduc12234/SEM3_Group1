using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using CampaignService.Contracts;
using CampaignService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CampaignService.Controllers;

[ApiController, Route("api/campaigns")]
public sealed class CampaignsController(ICampaignApplication service) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    private Guid? OptionalActor => User.Identity?.IsAuthenticated == true ? Actor : null;
    [HttpGet] public Task<object> Public([Range(1, 100000)] int page = 1, [MaxLength(200)] string? search = null, [MaxLength(50)] string? cause = null, CancellationToken ct = default)
        => service.List(null, null, page, search, cause, ct);
    [Authorize, HttpGet("organization/{org:guid}")] public Task<object> Organization(Guid org, [Range(1, 100000)] int page = 1, [Range(1, 100)] int pageSize = 5, CancellationToken ct = default)
        => service.List(org, Actor, page, null, null, ct, pageSize);
    [HttpGet("{id:guid}")] public Task<CampaignView> Detail(Guid id, CancellationToken ct) => service.Detail(id, OptionalActor, false, ct);
    [Authorize, HttpGet("{id:guid}/manage")] public Task<CampaignView> Manage(Guid id, CancellationToken ct) => service.Detail(id, Actor, true, ct);
    [Authorize, HttpPost] public async Task<IActionResult> Create(CampaignRequest request, CancellationToken ct)
    { var result = await service.Create(request, Actor, ct); return Created($"/api/campaigns/{result.Id}/manage", result); }
    [Authorize, HttpPut("{id:guid}")] public Task<CampaignView> Update(Guid id, CampaignRequest request, CancellationToken ct) => service.Update(id, request, Actor, ct);
    [Authorize, HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, VersionRequest request, CancellationToken ct)
    { await service.Delete(id, request.Version, Actor, ct); return NoContent(); }
    [Authorize, HttpPost("{id:guid}/submit")] public Task<CampaignView> Submit(Guid id, VersionRequest request, CancellationToken ct) => service.Submit(id, request.Version, Actor, ct);
    [Authorize, HttpPost("{id:guid}/review")] public Task<CampaignView> Review(Guid id, ReviewRequest request, CancellationToken ct) => service.Review(id, request, Actor, ct);
    [Authorize, HttpPost("{id:guid}/media"), RequestSizeLimit(11000000)]
    public Task<CampaignView> Upload(Guid id, [FromForm] string version, [FromForm] string kind, IFormFile file, CancellationToken ct, [FromForm] Guid? replaceId = null) => service.Upload(id, version, kind, file, Actor, ct, replaceId);
    [HttpGet("{id:guid}/media/{mediaId:guid}")]
    public async Task<IActionResult> Media(Guid id, Guid mediaId, CancellationToken ct)
    {
        var media = await service.Download(id, mediaId, OptionalActor, ct);
        Response.Headers.ContentDisposition = media.Kind == "DOCUMENT" ? "attachment" : "inline";
        return File(media.Content, media.ContentType);
    }
}
