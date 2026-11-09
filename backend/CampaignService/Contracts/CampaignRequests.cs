using System.ComponentModel.DataAnnotations;

namespace CampaignService.Contracts;

public sealed class CampaignRequest
{
    public Guid OrganizationId { get; set; }
    [Required, StringLength(200, MinimumLength = 3)] public string Title { get; set; } = "";
    [Required, StringLength(10000, MinimumLength = 30)] public string Description { get; set; } = "";
    [Required, RegularExpression("^COMBINED$")] public string CampaignType { get; set; } = "COMBINED";
    [Required, RegularExpression("^(CHILDREN|EDUCATION|DISABLED|WOMEN|YOUTH|ELDERLY|HEALTH|DISASTER_RELIEF|ENVIRONMENT|COMMUNITY)$")]
    public string Cause { get; set; } = "";
    [Required, StringLength(4000, MinimumLength = 1)] public string BeneficiaryDescription { get; set; } = "";
    [Range(typeof(decimal), "1", "9999999999999999")] public decimal GoalAmount { get; set; }
    [Range(1, 1000000)] public int VolunteerTarget { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    [Required, StringLength(400, MinimumLength = 3)] public string Location { get; set; } = "";
    [EmailAddress, MaxLength(256)] public string? ContactEmail { get; set; }
    [Required, RegularExpression(@"^\+?[0-9 ()-]{8,25}$")] public string ContactPhone { get; set; } = "";
    public string Version { get; set; } = "";
}
public sealed record VersionRequest([Required] string Version);
public sealed record ReviewRequest([Required] string Version,
    [Required, RegularExpression("^(APPROVE|REQUEST_CHANGES|REJECT)$")] string Decision,
    [MaxLength(2000)] string Note = "");
public sealed record CampaignView(Guid Id, Guid OrganizationId, Guid CreatedBy, string Title, string Description,
    string CampaignType, string Cause, string BeneficiaryDescription, decimal GoalAmount, int VolunteerTarget,
    DateOnly StartDate, DateOnly EndDate, string Location, string ContactEmail, string ContactPhone,
    string Status, string Version, DateTimeOffset CreatedAt, DateTimeOffset? SubmittedAt, DateTimeOffset? PublishedAt,
    object[] Media, object[] Reviews);
