using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OrganizationService.Contracts;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

[ApiController, Authorize, Route("api/organizations"), EnableRateLimiting("organization")]
public sealed class OrganizationInvitationsController(OrganizationInvitations organizationInvitations) : ControllerBase
{
    private OrganizationActor CurrentActor => OrganizationActor.From(User);

    [HttpGet("invitations/mine")]
    public async Task<IActionResult> Mine() =>
        Ok(await organizationInvitations.Mine(CurrentActor));

    [HttpGet("{id:guid}/workspace/invitations")]
    public async Task<IActionResult> List(Guid id, [FromQuery, Range(1, 100000)] int page = 1, CancellationToken cancellationToken = default) =>
        Ok(await organizationInvitations.List(CurrentActor, id, page, cancellationToken));

    [HttpPost("{id:guid}/workspace/invitations")]
    public async Task<IActionResult> Invite(Guid id, InviteMemberRequest request, CancellationToken cancellationToken) =>
        Created("/api/organizations/invitations/mine", await organizationInvitations.Invite(CurrentActor, id, request, cancellationToken));

    [HttpPost("invitations/{invitationId:guid}/respond")]
    public async Task<IActionResult> Respond(Guid invitationId, InvitationResponseRequest request, CancellationToken cancellationToken) =>
        Ok(await organizationInvitations.Respond(CurrentActor, invitationId, request, cancellationToken));

    [HttpPost("{id:guid}/workspace/invitations/{invitationId:guid}/revoke")]
    public async Task<IActionResult> Revoke(Guid id, Guid invitationId, VersionRequest request, CancellationToken cancellationToken) =>
        Ok(await organizationInvitations.Revoke(CurrentActor, id, invitationId, request, cancellationToken));
}
