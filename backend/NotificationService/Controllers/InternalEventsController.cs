using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Services;
using Shared;

namespace NotificationService.Controllers;

[ApiController, Route("internal/notifications/organization-events")]
public sealed class InternalEventsController(OrganizationEventReceiver receiver, IConfiguration configuration) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Receive(OrganizationNotificationEvent item, CancellationToken ct)
    {
        var expected = configuration["InternalApi:Key"];
        var supplied = Request.Headers["X-Internal-Key"].ToString();
        if (string.IsNullOrEmpty(expected) || string.IsNullOrEmpty(supplied) ||
            !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(expected)), SHA256.HashData(Encoding.UTF8.GetBytes(supplied)))) return Unauthorized();
        await receiver.Receive(item, ct);
        return NoContent();
    }
}
