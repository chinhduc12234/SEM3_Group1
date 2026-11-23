using CampaignService.Contracts;
using Shared;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    public async Task<CampaignVolunteerOpenings> VolunteerOpenings(Guid id, CancellationToken ct)
    {
        var campaign = await repository.Find(id, ct) ?? throw new ApiException(404, "Không tìm thấy chiến dịch đang tuyển tình nguyện viên.");
        if (!IsModernPublication(campaign) || campaign.OperationsConfirmedAt is null)
            throw new ApiException(404, "Chiến dịch chưa mở đăng ký tình nguyện viên.");

        var plan = ReadOperationsPlan(campaign);
        var days = plan.Days.OrderBy(day => day.Date).Select(day => new CampaignVolunteerOpeningDay(
            day.Id, day.Date, day.Title, day.Location,
            day.Activities.Select(activity => new CampaignVolunteerOpeningActivity(
                activity.Id, activity.Title, activity.Start, activity.End, activity.Location, activity.Tasks)).ToArray())).ToArray();
        var dayById = plan.Days.ToDictionary(day => day.Id);
        var activityById = plan.Days.SelectMany(day => day.Activities).ToDictionary(activity => activity.Id);
        var teamById = plan.Teams.ToDictionary(team => team.Id);
        var organizationMembers = await access.Members(campaign.OrganizationId, ct);
        var memberNames = organizationMembers.ToDictionary(member => member.UserId, member => member.FullName);
        var categoryById = VolunteerGroupCategories.ToDictionary(category => category.Id, category => category.Name, StringComparer.Ordinal);
        var groups = (plan.VolunteerGroups ?? []).Where(group => group.VolunteerCount > 0)
            .Select(group =>
            {
                var day = group.DayId is Guid dayId ? dayById.GetValueOrDefault(dayId) : null;
                var activity = group.ActivityId is Guid activityId ? activityById.GetValueOrDefault(activityId) : null;
                var team = group.TeamId is Guid teamId ? teamById.GetValueOrDefault(teamId) : null;
                var teamLeaderName = team?.LeadUserId is Guid leadUserId && memberNames.TryGetValue(leadUserId, out var leadName)
                    ? leadName : null;
                return new CampaignVolunteerOpeningGroup(group.Id, group.Name, group.CategoryId,
                    categoryById.GetValueOrDefault(group.CategoryId) ?? group.CategoryId, group.VolunteerCount,
                    group.DayId, day?.Date, day?.Title, group.ActivityId, activity?.Title,
                    group.TeamId, team?.Name, teamLeaderName, group.Notes);
            }).ToArray();

        if (groups.Length == 0)
            throw new ApiException(404, "Chiến dịch chưa có nhóm tình nguyện đang tuyển.");

        return new CampaignVolunteerOpenings(campaign.Id, campaign.Title, campaign.StartDate, campaign.EndDate,
            campaign.Location, days, groups);
    }
}
