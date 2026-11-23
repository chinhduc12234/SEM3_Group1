using System.ComponentModel.DataAnnotations;

namespace VolunteerService.Contracts;

public sealed class SubmitVolunteerRegistrationRequest
{
    [Required] public Guid CampaignId { get; set; }
    [Required, MinLength(1), MaxLength(20)] public Guid[] GroupIds { get; set; } = [];
    [Required, StringLength(200, MinimumLength = 2)] public string FullName { get; set; } = "";
    [Required, EmailAddress, MaxLength(320)] public string Email { get; set; } = "";
    [Required, RegularExpression(@"^\+?[0-9 ()-]{8,30}$")] public string PhoneNumber { get; set; } = "";
    public DateOnly? DateOfBirth { get; set; }
    [MaxLength(200)] public string? Occupation { get; set; }
    [MaxLength(1000)] public string? HealthNote { get; set; }
    [MaxLength(2000)] public string? Skills { get; set; }
    [MaxLength(3000)] public string? Experience { get; set; }
    [MaxLength(3000)] public string? Motivation { get; set; }
    [MaxLength(200)] public string? EmergencyContactName { get; set; }
    [RegularExpression(@"^\+?[0-9 ()-]{8,30}$")] public string? EmergencyContactPhone { get; set; }
    public bool CommitsToAllDays { get; set; }
    public bool AgreedToTerms { get; set; }
}

public sealed class ReviewVolunteerRegistrationRequest
{
    [Required, RegularExpression("^(APPROVE|WAITLIST|REJECT)$")] public string Decision { get; set; } = "";
    [MaxLength(20)] public Guid[] AssignedGroupIds { get; set; } = [];
    [MaxLength(2000)] public string? Note { get; set; }
}

public sealed record VolunteerRegistrationResult(Guid Id, Guid CampaignId, string Status,
    bool CommitsToAllDays, DateTimeOffset CreatedAt, VolunteerGroupPreferenceResult[] GroupPreferences);

public sealed record VolunteerGroupPreferenceResult(Guid GroupId, short PreferenceRank);

public sealed record VolunteerRegistrationSummary(Guid Id, Guid CampaignId, string FullName, string Email,
    string PhoneNumber, string Status, DateTimeOffset SubmittedAt,
    VolunteerGroupPreferenceResult[] GroupPreferences);

public sealed record VolunteerRegistrationPage(Guid CampaignId, string Status, int Page, int PageSize,
    int TotalCount, VolunteerRegistrationSummary[] Items);

public sealed record VolunteerRegistrationDetail(Guid Id, Guid CampaignId, string FullName, string Email,
    string PhoneNumber, DateOnly? DateOfBirth, string? Occupation, string? HealthNote, string? Skills,
    string? Experience, string? Motivation, string? EmergencyContactName, string? EmergencyContactPhone,
    bool CommitsToAllDays, bool AgreedToTerms, DateTimeOffset? TermsAgreedAt, string Status,
    Guid? ReviewedBy, DateTimeOffset? ReviewedAt, string? RejectionReason, DateTimeOffset SubmittedAt,
    VolunteerGroupPreferenceResult[] GroupPreferences,
    VolunteerGroupAssignmentResult[] AssignedGroups);

public sealed record VolunteerGroupAssignmentResult(Guid GroupId, string Status, Guid AssignedBy,
    DateTimeOffset AssignedAt);

public sealed record VolunteerReviewResult(Guid Id, Guid CampaignId, string Status, Guid ReviewedBy,
    DateTimeOffset ReviewedAt, string? ReviewNote, string? RejectionReason,
    VolunteerGroupAssignmentResult[] AssignedGroups);

public sealed record VolunteerGroupsManagementView(Guid CampaignId, string CampaignTitle, int PendingRegistrations,
    int ApprovedVolunteers, VolunteerGroupManagementItem[] Groups);

public sealed record VolunteerGroupManagementItem(Guid Id, string Name, string Category, int Target,
    int AssignedCount, int Remaining, DateOnly? Date, string? ActivityTitle, string? TeamName, string? TeamLeaderName);

public sealed record VolunteerGroupMember(Guid RegistrationId, string FullName, string Email, string PhoneNumber,
    DateTimeOffset AssignedAt, Guid AssignedBy);

// Public, read-only opening data returned by CampaignService. CampaignService remains the source of truth.
public sealed record CampaignVolunteerOpenings(Guid CampaignId, string CampaignTitle, DateOnly? StartDate,
    DateOnly? EndDate, string Location, CampaignVolunteerOpeningDay[] Days, CampaignVolunteerOpeningGroup[] Groups);

public sealed record CampaignVolunteerOpeningDay(Guid Id, DateOnly? Date, string Title, string Location,
    CampaignVolunteerOpeningActivity[] Activities);

public sealed record CampaignVolunteerOpeningActivity(Guid Id, string Title, TimeOnly? Start, TimeOnly? End,
    string Location, string Description);

public sealed record CampaignVolunteerOpeningGroup(Guid Id, string Name, string CategoryId, string Category,
    int Target, Guid? DayId, DateOnly? Date, string? DayTitle, Guid? ActivityId, string? ActivityTitle,
    Guid? TeamId, string? TeamName, string? TeamLeaderName, string Notes);
