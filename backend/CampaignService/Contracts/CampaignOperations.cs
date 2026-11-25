using System.ComponentModel.DataAnnotations;

namespace CampaignService.Contracts;

public sealed record CampaignOperationsRequest([Required] string Version, [Required] OperationsPlan Plan, bool Confirm);
public sealed record OperationsPlan(
    [Required, MaxLength(OperationsPlan.MaximumDays)] OperationsDay[] Days,
    [Required, MaxLength(50)] OperationsTeam[] Teams,
    [Required, MaxLength(300)] OperationsResource[] Resources,
    [MaxLength(300)] VolunteerGroup[]? VolunteerGroups = null)
{
    public const int MaximumDays = 366;
}
public sealed record OperationsDay(Guid Id, DateOnly? Date, [MaxLength(200)] string Title,
    [MaxLength(1000)] string Objective, [MaxLength(2000)] string Description, [MaxLength(400)] string Location,
    Guid? LeadUserId, [MaxLength(1000)] string Notes, [Required, MaxLength(50)] OperationsActivity[] Activities,
    bool ActivitiesDone = false, [MaxLength(1000)] string? ExtraReason = null,
    DateTimeOffset? ExtraApprovedAt = null, PlannedCampaignAddress? Address = null, OperationsMapPin? MapPin = null);
public sealed record OperationsMapPin([Range(-90, 90)] double Latitude, [Range(-180, 180)] double Longitude);
public sealed record ActivityAttendance([Range(0, 100000)] int StaffConfirmed, [Range(0, 100000)] int StaffPresent,
    [Range(0, 100000)] int VolunteersConfirmed, [Range(0, 100000)] int VolunteersPresent);
public sealed record SaveAttendanceRequest([Required] string Version, [Required] ActivityAttendance Attendance);
public sealed record OperationsActivity(Guid Id, [MaxLength(200)] string Title, TimeOnly? Start, TimeOnly? End,
    [MaxLength(400)] string Location, [MaxLength(2000)] string Tasks, Guid? LeadUserId,
    [Range(0, 100000)] int StaffNeeded, [Range(0, 100000)] int VolunteersNeeded,
    [Required, MaxLength(50)] Guid[] TeamIds, Guid? BackupUserId = null, ActivityAttendance? Attendance = null);
public sealed record OperationsTeam(Guid Id, [MaxLength(200)] string Name, [MaxLength(1000)] string Duties,
    Guid? LeadUserId, [Range(0, 100000)] int StaffNeeded, [Range(0, 100000)] int VolunteersNeeded,
    [MaxLength(1000)] string VolunteerSkills, [Required, MaxLength(100)] Guid[] StaffUserIds);
public sealed record OperationsResource(Guid Id, [MaxLength(100)] string Category, [MaxLength(200)] string Name,
    [Range(typeof(decimal), "0", "1000000")] decimal Quantity, [MaxLength(80)] string Unit,
    Guid? DayId, Guid? ActivityId, [MaxLength(1000)] string Notes, Guid? TeamId = null);
public sealed record VolunteerGroup(Guid Id, [MaxLength(200)] string Name, [MaxLength(40)] string CategoryId,
    [Range(0, 100000)] int VolunteerCount, Guid? DayId, Guid? ActivityId, Guid? TeamId, [MaxLength(1000)] string Notes,
    bool IsPriority = false, bool RequiresReview = false, [Range(0, 100000)] int? MinimumConfirmed = null);
public sealed record VolunteerGroupCategory(string Id, string Name);
public sealed record OperationsMember(Guid UserId, string FullName, bool CanLeadTeam);
public sealed record OperationsView(string Version, OperationsPlan Plan, DateTimeOffset? ConfirmedAt, bool CanEdit,
    OperationsMember[] Members, bool CanApproveExtraDays, bool HasAutomaticCalendar, VolunteerGroupCategory[] VolunteerGroupCategories,
    string? ConfirmedByName, bool CanRecordAttendance);
