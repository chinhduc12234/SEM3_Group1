using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Services;
using Shared;

namespace NotificationService.Controllers;

[ApiController, Route("internal/notifications/organization-events")]
public sealed class InternalEventsController(OrganizationEventReceiver receiver,
    VolunteerRegistrationEventReceiver volunteerReceiver, DonationEventReceiver donationReceiver,
    IConfiguration configuration) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Receive(OrganizationNotificationEvent item, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        await receiver.Receive(item, ct);
        return NoContent();
    }

    [HttpPost("/internal/notifications/campaign-assignments")]
    public async Task<IActionResult> ReceiveAssignment(CampaignAssignmentEvent item, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        await receiver.ReceiveAssignment(item, ct);
        return NoContent();
    }

    [HttpPost("/internal/notifications/volunteer-registration-submitted")]
    public async Task<IActionResult> ReceiveVolunteerRegistration(VolunteerRegistrationNotificationEvent item, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        await volunteerReceiver.Receive(item, ct);
        return NoContent();
    }

    [HttpPost("/internal/notifications/donation-confirmed")]
    public async Task<IActionResult> ReceiveDonation(DonationConfirmedNotificationEvent item, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        await donationReceiver.Receive(item, ct);
        return NoContent();
    }

    [HttpPost("/internal/notifications/fundraising-goal-reached")]
    public async Task<IActionResult> ReceiveFundraisingGoalReached(FundraisingGoalReachedNotificationEvent item, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        await donationReceiver.ReceiveGoalReached(item, ct);
        return NoContent();
    }

    [HttpPost("/internal/notifications/in-kind-pledge")]
    public async Task<IActionResult> ReceiveInKindPledge(InKindPledgeNotificationEvent item, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        await donationReceiver.ReceiveInKindPledge(item, ct);
        return NoContent();
    }

    private bool Authorized()
    {
        var expected = configuration["InternalApi:Key"];
        var supplied = Request.Headers["X-Internal-Key"].ToString();
        return !string.IsNullOrEmpty(expected) && !string.IsNullOrEmpty(supplied) &&
            CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(expected)), SHA256.HashData(Encoding.UTF8.GetBytes(supplied)));
    }
}
