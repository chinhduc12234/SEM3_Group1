using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VolunteerService.Contracts;
using VolunteerService.Services;

namespace VolunteerService.Controllers;

[ApiController, Authorize, Route("api/volunteers")]
public sealed class VolunteerRegistrationsController(IVolunteerRegistrationService service) : ControllerBase
{
    private Guid Actor => Guid.TryParse(User.FindFirstValue("sub"), out var id) ? id : throw new Shared.ApiException(401, "Tài khoản đăng nhập không hợp lệ.");

    [AllowAnonymous, HttpGet("campaigns/{campaignId:guid}/availability")]
    public Task<VolunteerAvailability> Availability(Guid campaignId, CancellationToken ct) => service.Availability(campaignId, ct);

    [HttpGet("me/registrations")]
    public Task<VolunteerRegistrationMine[]> Mine([Range(1, 10000)] int page = 1, Guid? campaignId = null, CancellationToken ct = default) =>
        service.Mine(Actor, page, campaignId, ct);

    [HttpGet("me/registrations/{id:guid}")]
    public Task<VolunteerRegistrationMine> Mine(Guid id, CancellationToken ct) => service.Mine(Actor, id, ct);

    [HttpGet("me/participation-history")]
    public Task<VolunteerParticipationHistory[]> ParticipationHistory([Range(1, 10000)] int page = 1, CancellationToken ct = default) =>
        service.ParticipationHistory(Actor, page, ct);

    [HttpGet("me/removal-history")]
    public Task<VolunteerRemovalHistory[]> RemovalHistory([Range(1, 10000)] int page = 1, Guid? registrationId = null, CancellationToken ct = default) =>
        service.RemovalHistory(Actor, page, registrationId, ct);

    [HttpPost("me/registrations/{id:guid}/offers/{offerId:guid}")]
    public Task<VolunteerRegistrationMine> Respond(Guid id, Guid offerId, VolunteerRespondRequest request, CancellationToken ct) =>
        service.Respond(Actor, id, offerId, request.Accept, ct);

    [HttpPost("me/registrations/{id:guid}/withdraw")]
    public Task<VolunteerRegistrationMine> Withdraw(Guid id, CancellationToken ct) => service.Withdraw(Actor, id, ct);
    [HttpPost("registrations")]
    public async Task<IActionResult> Submit(SubmitVolunteerRegistrationRequest request, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue("sub"), out var userId))
            return Unauthorized();
        var result = await service.Submit(userId, request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("campaigns/{campaignId:guid}/registrations")]
    public async Task<VolunteerRegistrationPage> ListForReview(Guid campaignId,
        [RegularExpression("^(SUBMITTED|UNDER_REVIEW|APPROVED|WAITLISTED|REJECTED|WITHDRAWN)$")] string status = "SUBMITTED",
        [Range(1, 100000)] int page = 1, [Range(1, 100)] int pageSize = 20, CancellationToken ct = default)
    {
        if (!Guid.TryParse(User.FindFirstValue("sub"), out var reviewerId)) throw new Shared.ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        return await service.ListForReview(reviewerId, campaignId, status, page, pageSize, ct);
    }

    [HttpGet("campaigns/{campaignId:guid}/groups")]
    public async Task<VolunteerGroupsManagementView> GroupManagement(Guid campaignId, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue("sub"), out var reviewerId))
            throw new Shared.ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        return await service.GroupManagement(reviewerId, campaignId, ct);
    }

    [HttpGet("campaigns/{campaignId:guid}/groups/{groupId:guid}/members")]
    public async Task<VolunteerGroupMember[]> GroupMembers(Guid campaignId, Guid groupId, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue("sub"), out var reviewerId))
            throw new Shared.ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        return await service.GroupMembers(reviewerId, campaignId, groupId, ct);
    }

    [HttpGet("registrations/{registrationId:guid}")]
    public async Task<VolunteerRegistrationDetail> GetForReview(Guid registrationId, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue("sub"), out var reviewerId)) throw new Shared.ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        return await service.GetForReview(reviewerId, registrationId, ct);
    }

    [HttpPost("registrations/{registrationId:guid}/review")]
    public async Task<VolunteerReviewResult> Review(Guid registrationId,
        ReviewVolunteerRegistrationRequest request, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue("sub"), out var reviewerId))
            throw new Shared.ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        return await service.Review(reviewerId, registrationId, request, ct);
    }

    [HttpDelete("registrations/{registrationId:guid}")]
    public async Task<IActionResult> Remove(Guid registrationId, CancellationToken ct)
    {
        await service.Remove(Actor, registrationId, ct);
        return NoContent();
    }
}
