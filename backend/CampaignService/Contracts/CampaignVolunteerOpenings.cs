namespace CampaignService.Contracts;

public sealed record CampaignVolunteerOpenings(Guid CampaignId, string CampaignTitle, DateOnly? StartDate,
    DateOnly? EndDate, string Location, CampaignVolunteerOpeningDay[] Days, CampaignVolunteerOpeningGroup[] Groups,
    string? Timezone = null);

public sealed record CampaignVolunteerOpeningDay(Guid Id, DateOnly? Date, string Title, string Location,
    CampaignVolunteerOpeningActivity[] Activities);

public sealed record CampaignVolunteerOpeningActivity(Guid Id, string Title, TimeOnly? Start, TimeOnly? End,
    string Location, string Description);

public sealed record CampaignVolunteerOpeningGroup(Guid Id, string Name, string CategoryId, string Category,
    int Target, Guid? DayId, DateOnly? Date, string? DayTitle, Guid? ActivityId, string? ActivityTitle,
    Guid? TeamId, string? TeamName, string? TeamLeaderName, string Notes, bool IsPriority = false, bool RequiresReview = false);
