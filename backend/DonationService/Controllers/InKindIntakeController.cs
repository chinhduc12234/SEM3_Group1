using System.ComponentModel.DataAnnotations;
using DonationService.Contracts;
using DonationService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DonationService.Controllers;

[ApiController, Authorize, Route("api/donations")]
public sealed class InKindIntakeController(InKindIntakeService intake) : ControllerBase
{
    private Guid Actor => DonationActor.From(User).UserId;

    [AllowAnonymous, HttpGet("campaigns/{campaignId:guid}/in-kind/point")]
    public Task<PublicInKindPoint> Point(Guid campaignId, CancellationToken ct) => intake.PublicPoint(campaignId, ct);

    [HttpPost("in-kind/appointments"), EnableRateLimiting("sandbox-create")]
    public async Task<IActionResult> Schedule(ScheduleInKindRequest request, CancellationToken ct) =>
        Created("/api/donations/in-kind/me", await intake.Schedule(Actor, request, ct));

    [HttpGet("in-kind/me")]
    public Task<InKindPledgeView[]> Mine([Range(1, 10_000)] int page = 1, CancellationToken ct = default) =>
        intake.Mine(Actor, page, ct);

    [HttpGet("in-kind/me/{id:guid}")]
    public Task<InKindPledgeView> Mine(Guid id, CancellationToken ct) => intake.Mine(Actor, id, ct);

    [HttpPut("in-kind/appointments/{id:guid}")]
    public Task<InKindPledgeView> Reschedule(Guid id, RescheduleInKindRequest request, CancellationToken ct) =>
        intake.ChangeSchedule(id, Actor, request.ScheduledAt, ct);

    [HttpDelete("in-kind/appointments/{id:guid}")]
    public Task<InKindPledgeView> Cancel(Guid id, CancellationToken ct) => intake.ChangeSchedule(id, Actor, null, ct);

    [HttpPost("campaigns/{campaignId:guid}/in-kind/receipts")]
    public async Task<IActionResult> Receive(Guid campaignId, ReceiveInKindBatchRequest request, CancellationToken ct) =>
        Created($"/api/donations/campaigns/{campaignId}/in-kind/receipts", await intake.Receive(campaignId, Actor, request, ct));

    [HttpGet("campaigns/{campaignId:guid}/in-kind/receipts")]
    public Task<InKindReceiptView[]> List(Guid campaignId, [Range(1, 10_000)] int page = 1, CancellationToken ct = default) =>
        intake.RecentReceipts(campaignId, Actor, page, ct);

    [HttpPost("campaigns/{campaignId:guid}/in-kind/receipts/{receiptId:guid}/reverse")]
    public Task<InKindReceiptView> Reverse(Guid campaignId, Guid receiptId, ReverseInKindReceiptRequest request, CancellationToken ct) =>
        intake.Reverse(campaignId, receiptId, Actor, request, ct);
}
