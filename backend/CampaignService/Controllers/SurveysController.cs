using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using CampaignService.Contracts;
using CampaignService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CampaignService.Controllers;

[NonController, ApiController, Authorize, Route("api/campaigns/surveys"), EnableRateLimiting("organization")]
public sealed class SurveysController(ISurveyApplication service) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    [HttpGet("organizations/{org:guid}/dashboard")]
    public Task<object> Dashboard(Guid org, string mode = "mine", CancellationToken ct = default) => service.Dashboard(org, Actor, mode, ct);
    [HttpGet("organizations/{org:guid}/reports")]
    public Task<object> List(Guid org, string mode = "mine", [MaxLength(30)] string? status = null, [Range(1, 100000)] int page = 1, CancellationToken ct = default)
        => service.List(org, Actor, mode, status, page, ct);
    [HttpPost("organizations/{org:guid}/reports")]
    public async Task<IActionResult> Create(Guid org, SurveyRequest request, CancellationToken ct)
    { var id = await service.Create(org, request, Actor, ct); return Created($"/api/campaigns/surveys/reports/{id}", await service.Detail(id, Actor, ct)); }
    [HttpGet("reports/{id:guid}")]
    public Task<object> Detail(Guid id, CancellationToken ct) => service.Detail(id, Actor, ct);
    [HttpPut("reports/{id:guid}")]
    public async Task<object> Update(Guid id, SurveyRequest request, CancellationToken ct)
    { await service.Update(id, request, Actor, ct); return await service.Detail(id, Actor, ct); }
    [HttpDelete("reports/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, VersionRequest request, CancellationToken ct)
    { await service.Delete(id, request.Version, Actor, ct); return NoContent(); }
    [HttpPost("reports/{id:guid}/submit")]
    public async Task<object> Submit(Guid id, VersionRequest request, CancellationToken ct)
    { await service.Submit(id, request.Version, Actor, ct); return await service.Detail(id, Actor, ct); }
    [HttpPost("reports/{id:guid}/review")]
    public async Task<object> Review(Guid id, SurveyReviewRequest request, CancellationToken ct)
    { await service.Review(id, request, Actor, ct); return await service.Detail(id, Actor, ct); }
    [HttpPost("reports/{id:guid}/images"), RequestSizeLimit(53 * 1024 * 1024), RequestFormLimits(MultipartBodyLengthLimit = 53 * 1024 * 1024)]
    public async Task<object> Upload(Guid id, [FromForm, Required] string version, [FromForm] List<IFormFile> files, CancellationToken ct)
    { await service.Upload(id, version, files, Actor, ct); return await service.Detail(id, Actor, ct); }
    [HttpDelete("reports/{id:guid}/images/{imageId:guid}")]
    public async Task<object> RemoveImage(Guid id, Guid imageId, VersionRequest request, CancellationToken ct)
    { await service.RemoveImage(id, imageId, request.Version, Actor, ct); return await service.Detail(id, Actor, ct); }
    [HttpGet("reports/{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> Image(Guid id, Guid imageId, CancellationToken ct)
    { var image = await service.Image(id, imageId, Actor, ct); Response.Headers.ContentDisposition = "inline"; return File(image.Content, image.ContentType); }
    [HttpGet("organizations/{org:guid}/notifications")]
    public Task<object> Notifications(Guid org, [Range(1, 100000)] int page = 1, CancellationToken ct = default) => service.Notifications(org, Actor, page, ct);
    [HttpPost("notifications/{id:guid}/read")]
    public async Task<IActionResult> ReadNotification(Guid id, CancellationToken ct)
    { await service.ReadNotification(id, Actor, ct); return NoContent(); }
}
