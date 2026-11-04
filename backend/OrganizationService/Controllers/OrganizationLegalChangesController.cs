using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OrganizationService.Contracts;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

[ApiController, Authorize, Route("api/organizations"), EnableRateLimiting("organization")]
public sealed class OrganizationLegalChangesController(OrganizationLegalChanges organizationLegalChanges) : ControllerBase
{
    private OrganizationActor CurrentActor => OrganizationActor.From(User);

    [HttpGet("{id:guid}/workspace/legal-changes")]
    public async Task<IActionResult> List(Guid id, [FromQuery, Range(1, 100000)] int page = 1) =>
        Ok(await organizationLegalChanges.List(CurrentActor, id, page));

    [Authorize(Roles = "ADMIN"), HttpGet("admin/legal-changes")]
    public async Task<IActionResult> Pending([FromQuery, Range(1, 100000)] int page = 1) =>
        Ok(await organizationLegalChanges.Pending(page));

    [HttpGet("{id:guid}/workspace/legal-changes/{changeId:guid}")]
    public async Task<IActionResult> Detail(Guid id, Guid changeId) =>
        Ok(await organizationLegalChanges.Detail(CurrentActor, id, changeId));

    [HttpPost("{id:guid}/workspace/legal-changes"), RequestSizeLimit(17 * 1024 * 1024)]
    public async Task<IActionResult> Create(Guid id, [FromForm, Required] string proposal, [FromForm, Required, StringLength(2000, MinimumLength = 3)] string reason,
        [FromForm, Required] IFormFile registration, [FromForm, Required] IFormFile representativeId, [FromForm, Required] IFormFile authorization,
        CancellationToken cancellationToken)
    {
        var result = await organizationLegalChanges.Create(CurrentActor, id, proposal, reason,
            new OrganizationUpload(registration.FileName, registration.Length, registration.OpenReadStream),
            new OrganizationUpload(representativeId.FileName, representativeId.Length, representativeId.OpenReadStream),
            new OrganizationUpload(authorization.FileName, authorization.Length, authorization.OpenReadStream),
            cancellationToken);
        return Created($"/api/organizations/{id}/workspace/legal-changes/{result.Id}", result.Body);
    }

    [HttpGet("{id:guid}/workspace/legal-changes/{changeId:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> Download(Guid id, Guid changeId, Guid documentId)
    {
        var result = await organizationLegalChanges.Download(CurrentActor, id, changeId, documentId);
        return File(result.Content, result.ContentType, result.FileName);
    }

    [Authorize(Roles = "ADMIN"), HttpPost("{id:guid}/workspace/legal-changes/{changeId:guid}/review")]
    public async Task<IActionResult> Review(Guid id, Guid changeId, LegalChangeReviewRequest request, CancellationToken cancellationToken) =>
        Ok(await organizationLegalChanges.Review(CurrentActor, id, changeId, request, cancellationToken));
}
