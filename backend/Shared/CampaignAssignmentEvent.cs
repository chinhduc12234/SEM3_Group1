using System.Text.Json.Serialization;

namespace Shared;

public sealed record CampaignAssignmentEvent(Guid EventId, Guid OrganizationId, Guid CampaignId, Guid UserId,
    string CampaignTitle, string[] Roles, Guid? ActivityReportId = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool CampaignStarted = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool ScheduleChanged = false);
