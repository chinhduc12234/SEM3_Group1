using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OrganizationService.Contracts;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

[ApiController, Authorize, Route("api/organizations"), EnableRateLimiting("organization")]
public sealed class OrganizationWorkspaceController(OrganizationWorkspaceService organizationWorkspaceService, OrganizationMembers organizationMembers) : ControllerBase
{
    private OrganizationActor CurrentActor => OrganizationActor.From(User);

    [HttpGet("workspaces/mine")]
    public async Task<IActionResult> Mine() =>
        Ok(await organizationWorkspaceService.Mine(CurrentActor));

    [HttpGet("{id:guid}/workspace")]
    public async Task<IActionResult> Detail(Guid id) =>
        Ok(await organizationWorkspaceService.Detail(CurrentActor, id));

    [HttpPut("{id:guid}/workspace/profile")]
    public async Task<IActionResult> Update(Guid id, WorkspaceRequest request, CancellationToken cancellationToken) =>
        Ok(await organizationWorkspaceService.Update(CurrentActor, id, request, cancellationToken));

    [HttpGet("{id:guid}/workspace/permissions")]
    public async Task<IActionResult> Permissions(Guid id) =>
        Ok(await organizationWorkspaceService.Permissions(CurrentActor, id));

    [HttpPost("{id:guid}/workspace/media/{kind}"), RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid id, string kind, [Required] IFormFile file, [FromForm, Required] string version, CancellationToken cancellationToken) =>
        Ok(await organizationWorkspaceService.Upload(CurrentActor, id, kind,
            new OrganizationUpload(file.FileName, file.Length, file.OpenReadStream), version, cancellationToken));

    [HttpGet("{id:guid}/workspace/media/{kind}")]
    public async Task<IActionResult> Image(Guid id, string kind)
    {
        var result = await organizationWorkspaceService.Image(CurrentActor, id, kind);
        return result is { } file ? File(file.Content, file.ContentType) : NotFound();
    }

    [HttpGet("{id:guid}/workspace/members")]
    public async Task<IActionResult> Members(Guid id, [FromQuery, Range(1, 100000)] int page = 1, CancellationToken cancellationToken = default) =>
        Ok(await organizationMembers.Members(CurrentActor, id, page, cancellationToken));

    [HttpPut("{id:guid}/workspace/members/{memberId:guid}/roles")]
    public async Task<IActionResult> Roles(Guid id, Guid memberId, MemberRolesRequest request, CancellationToken cancellationToken) =>
        Ok(await organizationMembers.Roles(CurrentActor, id, memberId, request, cancellationToken));

    [HttpPut("{id:guid}/workspace/members/{memberId:guid}/state")]
    public async Task<IActionResult> State(Guid id, Guid memberId, MemberStateRequest request, CancellationToken cancellationToken) =>
        Ok(await organizationMembers.State(CurrentActor, id, memberId, request, cancellationToken));

    [HttpGet("{id:guid}/workspace/activity")]
    public async Task<IActionResult> Activity(Guid id, [FromQuery, Range(1, 100000)] int page = 1) =>
        Ok(await organizationMembers.Activity(CurrentActor, id, page, HttpContext.RequestAborted));
}
