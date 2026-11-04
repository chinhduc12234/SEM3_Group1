using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

[ApiController, Authorize(Roles = "ADMIN"), Route("api/organizations/notifications"), EnableRateLimiting("organization")]
public sealed class EmailNotificationsController(EmailNotificationService emailNotificationService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery, Range(1, 100000)] int page = 1,
        [FromQuery, RegularExpression("^(PENDING|SENT|FAILED)?$")] string state = "", [FromQuery] Guid? organizationId = null) =>
        Ok(await emailNotificationService.List(page, state, organizationId));

    [HttpPost("{id:guid}/retry")]
    public async Task<IActionResult> Retry(Guid id)
    {
        await emailNotificationService.Retry(id);
        return Accepted(new { message = "Đã đưa thông báo vào hàng đợi gửi lại." });
    }
}
