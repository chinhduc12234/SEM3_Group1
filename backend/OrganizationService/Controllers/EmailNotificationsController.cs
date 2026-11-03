using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Controllers;

[ApiController, Authorize(Roles = "ADMIN"), Route("api/organizations/notifications"), EnableRateLimiting("organization")]
public sealed class EmailNotificationsController(OrganizationDb db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery, Range(1, 100000)] int page = 1,
        [FromQuery, RegularExpression("^(PENDING|SENT|FAILED)?$")] string state = "", [FromQuery] Guid? organizationId = null)
    {
        var query = db.EmailNotifications.AsNoTracking();
        if (state != "") query = query.Where(x => x.State == state);
        if (organizationId.HasValue) query = query.Where(x => x.OrganizationId == organizationId);
        return Ok(new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = await query.OrderByDescending(x => x.Sequence).Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.OrganizationId, x.EventId, x.Action, x.State, x.Attempts, x.CreatedAt, x.NextAttemptAt, x.SentAt, x.LastErrorCode }).ToListAsync() });
    }

    [HttpPost("{id:guid}/retry")]
    public async Task<IActionResult> Retry(Guid id)
    {
        var changed = await db.EmailNotifications.Where(x => x.Id == id && x.State == "FAILED")
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.State, "PENDING").SetProperty(x => x.Attempts, 0)
                .SetProperty(x => x.NextAttemptAt, DateTimeOffset.UtcNow).SetProperty(x => x.LastErrorCode, (string?)null));
        if (changed == 0) throw new ApiException(409, "Chỉ có thể gửi lại thông báo đã thất bại.");
        return Accepted(new { message = "Đã đưa thông báo vào hàng đợi gửi lại." });
    }
}
