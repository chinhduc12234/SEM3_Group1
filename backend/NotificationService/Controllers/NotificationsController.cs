using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using NotificationService.Contracts;
using NotificationService.Services;

namespace NotificationService.Controllers;

[Authorize, ApiController, Route("api/notifications"), EnableRateLimiting("organization")]
public sealed class NotificationsController(NotificationInbox inbox, IOptions<FirebaseOptions> options) : ControllerBase
{
    private NotificationActor Actor => NotificationActor.From(User);
    [HttpGet]
    public Task<NotificationPage> List([FromQuery] int page = 1, [FromQuery] bool unread = false, CancellationToken ct = default) =>
        inbox.List(Actor, Math.Clamp(page, 1, 10000), unread, ct);
    [HttpGet("unread-count")]
    public async Task<object> Unread(CancellationToken ct) => new { count = await inbox.Unread(Actor, ct) };
    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id, CancellationToken ct) { await inbox.Read(Actor, id, ct); return NoContent(); }
    [HttpPut("read-all")]
    public async Task<IActionResult> ReadAll(ReadAllRequest request, CancellationToken ct) { await inbox.ReadAll(Actor, request.Through, ct); return NoContent(); }
    [HttpPost("push-subscriptions")]
    public async Task<IActionResult> Subscribe(SubscribeRequest request, CancellationToken ct) { await inbox.Subscribe(Actor, request.Token, ct); return NoContent(); }
    [HttpDelete("push-subscriptions/current-session")]
    public async Task<IActionResult> Unsubscribe(CancellationToken ct) { await inbox.Unsubscribe(Actor, ct); return NoContent(); }
    [AllowAnonymous, HttpGet("config")]
    public object Config() => options.Value.PublicConfig();
}
