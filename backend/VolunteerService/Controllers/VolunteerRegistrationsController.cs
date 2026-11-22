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
}
