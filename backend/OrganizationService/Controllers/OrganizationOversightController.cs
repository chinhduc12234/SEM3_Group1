using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OrganizationService.Contracts;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

[ApiController, Authorize(Roles = "ADMIN"), Route("api/organizations/admin"), EnableRateLimiting("organization")]
public sealed class OrganizationOversightController(OrganizationOversight organizationOversight) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<IActionResult> Overview() =>
        Ok(await organizationOversight.Overview());

    [HttpGet("directory")]
    public async Task<IActionResult> Directory([FromQuery, Range(1, 100000)] int page = 1,
        [FromQuery, MaxLength(100)] string search = "", [FromQuery, MaxLength(40)] string focus = "")
    {
        var result = await organizationOversight.Directory(page, search, focus);
        return result is null ? BadRequest(new { title = "Lĩnh vực không hợp lệ." }) : Ok(result);
    }
}
