using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OrganizationService.Contracts;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

[ApiController, Authorize, Route("api/organizations"), EnableRateLimiting("organization")]
public sealed class OrganizationsController(OrganizationApplications organizationApplications) : ControllerBase
{
    private OrganizationActor CurrentActor => OrganizationActor.From(User);

    [HttpGet("mine")]
    public async Task<IActionResult> Mine() =>
        Ok(await organizationApplications.Mine(CurrentActor));

    [Authorize(Roles = "ADMIN"), HttpGet]
    public async Task<IActionResult> List([FromQuery, Range(1, 100000)] int page = 1,
        [FromQuery, MaxLength(100)] string search = "", [FromQuery, MaxLength(30)] string status = "") =>
        Ok(await organizationApplications.List(page, search, status));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detail(Guid id) =>
        Ok(await organizationApplications.Detail(CurrentActor, id));

    [HttpPost]
    public async Task<IActionResult> Create(OrganizationRequest request)
    {
        var result = await organizationApplications.Create(CurrentActor, request, HttpContext.RequestAborted);
        return Created($"/api/organizations/{result.Id}", result.Body);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, OrganizationRequest request) =>
        Ok(await organizationApplications.Update(CurrentActor, id, request, HttpContext.RequestAborted));

    [HttpPost("{id:guid}/documents/{kind}"), RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid id, string kind, [Required] IFormFile file, [FromForm, Required] string version) =>
        Ok(await organizationApplications.Upload(CurrentActor, id, kind,
            new OrganizationUpload(file.FileName, file.Length, file.OpenReadStream), version, HttpContext.RequestAborted));

    [HttpGet("{id:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> Download(Guid id, Guid documentId)
    {
        var result = await organizationApplications.Download(CurrentActor, id, documentId);
        return File(result.Content, result.ContentType, result.FileName);
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, VersionRequest request) =>
        Ok(await organizationApplications.Submit(CurrentActor, id, request, HttpContext.RequestAborted));

    [Authorize(Roles = "ADMIN"), HttpPost("{id:guid}/review")]
    public async Task<IActionResult> Review(Guid id, ReviewRequest request) =>
        Ok(await organizationApplications.Review(CurrentActor, id, request, HttpContext.RequestAborted));
}
