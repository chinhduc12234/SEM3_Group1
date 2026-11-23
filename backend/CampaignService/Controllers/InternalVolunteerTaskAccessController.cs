using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CampaignService.Contracts;
using CampaignService.Data;
using CampaignService.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CampaignService.Controllers;

// Service-only endpoint used by VolunteerService to authorize an operational team lead.
[ApiController, Route("internal/campaigns")]
public sealed class InternalVolunteerTaskAccessController(CampaignDb db, IConfiguration config,
    IOrganizationAccess access) : ControllerBase
{
    private static readonly JsonSerializerOptions SnapshotJson = new(JsonSerializerDefaults.Web);

    private bool Authorized()
    {
        var key = config["InternalApi:Key"];
        var supplied = Request.Headers["X-Internal-Key"].ToString();
        return !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(supplied) &&
            CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)),
                SHA256.HashData(Encoding.UTF8.GetBytes(supplied)));
    }

    [HttpGet("{campaignId:guid}/activities/{activityId:guid}/groups/{groupId:guid}/task-access/{userId:guid}")]
    public async Task<IActionResult> TaskAccess(Guid campaignId, Guid activityId, Guid groupId,
        Guid userId, CancellationToken ct)
    {
        if (!Authorized()) return Unauthorized();
        var campaign = await db.Campaigns.AsNoTracking().Where(x => x.Id == campaignId)
            .Select(x => new { x.OrganizationId, x.Status, x.OperationsPlan, x.OperationsConfirmedAt })
            .SingleOrDefaultAsync(ct);
        if (campaign is null) return NotFound();
        if (campaign.Status != "PUBLISHED" || campaign.OperationsConfirmedAt is null ||
            string.IsNullOrWhiteSpace(campaign.OperationsPlan))
            return Ok(new { canManage = false, groupTarget = 0, activityStart = (TimeOnly?)null, activityEnd = (TimeOnly?)null });

        var plan = JsonSerializer.Deserialize<OperationsPlan>(campaign.OperationsPlan, SnapshotJson);
        var day = plan?.Days.FirstOrDefault(item => item.Activities.Any(activity => activity.Id == activityId));
        var activity = day?.Activities.FirstOrDefault(item => item.Id == activityId);
        var group = plan?.VolunteerGroups?.FirstOrDefault(item => item.Id == groupId);
        var team = group?.TeamId is Guid teamId ? plan?.Teams.FirstOrDefault(item => item.Id == teamId) : null;
        var linked = day is not null && activity is not null && group is not null && team is not null &&
            group.VolunteerCount > 0 && group.DayId == day.Id &&
            (group.ActivityId is null || group.ActivityId == activityId) &&
            activity.TeamIds.Contains(team.Id) && team.LeadUserId == userId;
        if (!linked)
            return Ok(new { canManage = false, groupTarget = 0, activityStart = (TimeOnly?)null, activityEnd = (TimeOnly?)null });

        // Do not authorize a former staff member based only on an old operations-plan snapshot.
        var activeMember = (await access.Members(campaign.OrganizationId, ct)).Any(member => member.UserId == userId);
        return Ok(new
        {
            canManage = activeMember,
            groupTarget = group!.VolunteerCount,
            activityStart = activity!.Start,
            activityEnd = activity.End
        });
    }
}
