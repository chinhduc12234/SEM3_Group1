using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IdentityService.Controllers;

// Only service-to-service traffic: gateway deliberately does not expose this route.
[ApiController, Route("internal/session"), Authorize]
public sealed class SessionController : ControllerBase
{
    [HttpGet] public IActionResult Validate() => NoContent();
}
