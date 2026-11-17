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
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Members(Guid id, [FromQuery, Range(1, 100000)] int page = 1,
        [FromQuery, Range(1, 50)] int pageSize = 20, [FromQuery, MaxLength(120)] string? search = null,
        [FromQuery, MaxLength(40)] string? role = null, [FromQuery, RegularExpression("^(ACTIVE|SUSPENDED|UNLINKED)$")] string? status = null,
        CancellationToken cancellationToken = default) =>
        Ok(await organizationMembers.Members(CurrentActor, id, page, pageSize, search, role, status, cancellationToken));

    [HttpPost("{id:guid}/workspace/members"), RequestSizeLimit(512 * 1024)]
    public async Task<IActionResult> CreateMember(Guid id, CreateMemberRequest request, CancellationToken cancellationToken)
    {
        var memberId = await organizationMembers.Create(CurrentActor, id, request, cancellationToken);
        return CreatedAtAction(nameof(MemberProfile), new { id, memberId }, new { id = memberId });
    }

    [HttpDelete("{id:guid}/workspace/members/{memberId:guid}")]
    public async Task<IActionResult> DeleteMember(Guid id, Guid memberId, [FromQuery, Required, MaxLength(24)] string version, CancellationToken cancellationToken)
    {
        await organizationMembers.Delete(CurrentActor, id, memberId, version, cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/workspace/members/{memberId:guid}/profile")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> MemberProfile(Guid id, Guid memberId, CancellationToken cancellationToken) =>
        Ok(await organizationMembers.Profile(CurrentActor, id, memberId, cancellationToken));

    [HttpPut("{id:guid}/workspace/members/{memberId:guid}/profile"), RequestSizeLimit(512 * 1024)]
    public async Task<IActionResult> UpdateMemberProfile(Guid id, Guid memberId, MemberProfileRequest request, CancellationToken cancellationToken) =>
        Ok(await organizationMembers.UpdateProfile(CurrentActor, id, memberId, request, cancellationToken));

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
