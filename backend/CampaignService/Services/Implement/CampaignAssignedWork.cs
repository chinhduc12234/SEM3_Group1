using CampaignService.Contracts;
using Microsoft.EntityFrameworkCore;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    private static readonly string[] FieldRoles = ["OWNER", "ORGANIZATION_MANAGER", "CAMPAIGN_MANAGER",
        "VOLUNTEER_COORDINATOR", "FINANCE_MANAGER", "STAFF", "SURVEY_STAFF"];

    public async Task<AssignedFieldWork> AssignedWork(Guid org, Guid actor, int page, CancellationToken ct)
    {
        await access.Require(org, actor, FieldRoles, ct);
        // Filter by assignment at SQL Server before paginating so other staff plans are never materialized.
        var rows = db.Campaigns.FromSql($"""
            SELECT c.* FROM dbo.Campaigns c
            WHERE c.OrganizationId = {org} AND c.Status = 'PUBLISHED' AND c.OperationsConfirmedAt IS NOT NULL
            AND (EXISTS (
                SELECT 1 FROM OPENJSON(c.OperationsPlan, '$.teams') t
                WHERE TRY_CONVERT(uniqueidentifier, JSON_VALUE(t.value, '$.leadUserId')) = {actor}
                OR EXISTS (
                    SELECT 1 FROM OPENJSON(t.value, '$.staffUserIds') s
                    WHERE TRY_CONVERT(uniqueidentifier, s.value) = {actor}
                )
            ) OR EXISTS (
                SELECT 1 FROM OPENJSON(c.BudgetPlan, '$.receiving.goods.receiverUserIds') receiver
                WHERE TRY_CONVERT(uniqueidentifier, receiver.value) = {actor}
            ))
            """).AsNoTracking();
        const int pageSize = 10;
        var totalCount = await rows.CountAsync(ct);
        var campaigns = await rows.OrderByDescending(row => row.StartDate).ThenBy(row => row.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct);
        var items = campaigns.Select(campaign =>
        {
            var plan = ReadOperationsPlan(campaign);
            var assigned = plan.Teams.Where(team => team.LeadUserId == actor || team.StaffUserIds.Contains(actor)).ToArray();
            var shifts = (from day in plan.Days
                          from activity in day.Activities
                          from team in assigned
                          where activity.TeamIds.Contains(team.Id)
                          select new AssignedShift(day.Date, activity.Id, activity.Title, activity.Start, activity.End,
                              activity.Location, team.Name, team.LeadUserId == actor ? team.LeadUserId : null,
                              team.LeadUserId == actor ? (plan.VolunteerGroups ?? []).Where(item => item.TeamId == team.Id &&
                                  item.DayId == day.Id && (item.ActivityId is null || item.ActivityId == activity.Id) &&
                                  item.VolunteerCount > 0).Select(item => new AssignedTaskGroup(item.Id, item.Name, item.VolunteerCount)).ToArray() : [])).ToArray();
            var canReceive = ReadBudgetPlan(campaign)?.Receiving?.Goods?.ReceiverUserIds?.Contains(actor) == true;
            return new AssignedCampaign(campaign.Id, campaign.Title, shifts, canReceive);
        }).ToArray();
        return new(items, totalCount, page, pageSize);
    }
}
