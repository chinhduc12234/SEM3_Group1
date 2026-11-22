using System.ComponentModel.DataAnnotations;

namespace VolunteerService.Contracts;

public class VolunteerTaskFieldsRequest
{
    [Required, StringLength(255, MinimumLength = 2)] public string Name { get; set; } = "";
    [Required, StringLength(4000, MinimumLength = 1)] public string Description { get; set; } = "";
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    [Range(1, 100000)] public int RequiredVolunteers { get; set; }
    [Required, RegularExpression("^(LOW|MEDIUM|HIGH|URGENT)$")] public string Priority { get; set; } = "MEDIUM";
    [MaxLength(2000)] public string? Note { get; set; }
}

public sealed class CreateVolunteerTaskRequest : VolunteerTaskFieldsRequest
{
    [Required] public Guid CampaignId { get; set; }
    [Required] public Guid ActivityId { get; set; }
    [Required] public Guid GroupId { get; set; }
}

public sealed class UpdateVolunteerTaskRequest : VolunteerTaskFieldsRequest { }

public sealed class AssignVolunteersToTaskRequest
{
    [Required, MinLength(1), MaxLength(100)] public Guid[] RegistrationIds { get; set; } = [];
}

public sealed record VolunteerTaskAssignmentView(Guid Id, Guid RegistrationId, string VolunteerName,
    string Status, Guid AssignedBy, DateTimeOffset AssignedAt, DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt, string? VolunteerNote, string? ManagerNote);

public sealed record VolunteerTaskView(Guid Id, Guid CampaignId, Guid ActivityId, Guid GroupId,
    string Name, string Description, TimeOnly? StartTime, TimeOnly? EndTime, int RequiredVolunteers,
    int AssignedVolunteers, string Priority, string Status, string? Note, Guid CreatedBy,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, VolunteerTaskAssignmentView[] Assignments);

public sealed record MyVolunteerTaskView(Guid AssignmentId, Guid TaskId, Guid CampaignId, Guid ActivityId,
    Guid GroupId, string Name, string Description, TimeOnly? StartTime, TimeOnly? EndTime,
    string Priority, string TaskStatus, string AssignmentStatus, DateTimeOffset AssignedAt,
    DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt, string? VolunteerNote, string? ManagerNote);

public sealed record CampaignTaskAccessResult(bool CanManage, int GroupTarget,
    TimeOnly? ActivityStart, TimeOnly? ActivityEnd);
