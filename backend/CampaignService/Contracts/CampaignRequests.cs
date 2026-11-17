using System.ComponentModel.DataAnnotations;

namespace CampaignService.Contracts;

public sealed class CampaignRequest
{
    public Guid OrganizationId { get; set; }
    [MaxLength(200)] public string Title { get; set; } = "";
    [MaxLength(10000)] public string Description { get; set; } = "";
    [RegularExpression("^(CAMPAIGN|EVENT|COMBINED)$")] public string CampaignType { get; set; } = "COMBINED";
    [RegularExpression("^(CHILDREN|EDUCATION|DISABLED|WOMEN|YOUTH|ELDERLY|HEALTH|DISASTER_RELIEF|ENVIRONMENT|COMMUNITY)$")]
    public string Cause { get; set; } = "";
    [MaxLength(4000)] public string BeneficiaryDescription { get; set; } = "";
    public decimal GoalAmount { get; set; }
    public int VolunteerTarget { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    [MaxLength(400)] public string Location { get; set; } = "";
    private string? contactEmail;
    [EmailAddress, MaxLength(256)] public string? ContactEmail
    {
        get => contactEmail;
        set => contactEmail = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
    [MaxLength(25)] public string ContactPhone { get; set; } = "";
    public CampaignConcept? Concept { get; set; }
    public string Version { get; set; } = "";
}
public sealed record CampaignConcept(
    [MaxLength(500)] string ShortDescription = "",
    [MaxLength(4000)] string PrimaryGoal = "",
    [MaxLength(4000)] string Mission = "",
    [MaxLength(4000)] string ExpectedOutcomes = "",
    [MaxLength(4000)] string SuccessCriteria = "",
    [Range(1, int.MaxValue)] int? EstimatedBeneficiaries = null,
    [MaxLength(4000)] string BeneficiaryCriteria = "",
    [MaxLength(4000)] string PlannedScale = "",
    [MaxLength(4000)] string InitialRequirements = "",
    [MaxLength(4000)] string RiskNotes = "",
    [MaxLength(200)] string TentativeTime = "",
    [RegularExpression("^(IN_PERSON|ONLINE|HYBRID)$")] string? EventFormat = null,
    Guid? ParentCampaignId = null,
    [MaxLength(100)] string Timezone = "Asia/Ho_Chi_Minh",
    [MaxLength(200)] string? OnlinePlatform = null,
    TimeOnly? EventStartTime = null,
    TimeOnly? EventEndTime = null,
    PlannedCampaignAddress? PlannedAddress = null);
public sealed record CampaignAddressUnit([Range(1, 99999)] int Code, [Required, MaxLength(100)] string Name);
public sealed record PlannedCampaignAddress(
    [Required, RegularExpression("^(CURRENT|LEGACY)$")] string Mode,
    CampaignAddressUnit? Province,
    CampaignAddressUnit? District,
    CampaignAddressUnit? Ward,
    [MaxLength(200)] string? Detail);
public sealed record VersionRequest([Required] string Version);
public sealed record ReviewRequest([Required] string Version,
    [Required, RegularExpression("^(APPROVE|REQUEST_CHANGES|REJECT)$")] string Decision,
    [MaxLength(2000)] string Note = "");
public sealed record CampaignView(Guid Id, Guid OrganizationId, Guid CreatedBy, string Title, string Description,
    string CampaignType, string Cause, string BeneficiaryDescription, decimal GoalAmount, int VolunteerTarget,
    DateOnly? StartDate, DateOnly? EndDate, string Location, string ContactEmail, string ContactPhone,
    string Status, string Version, DateTimeOffset CreatedAt, DateTimeOffset? SubmittedAt, DateTimeOffset? PublishedAt,
    object[] Media, object[] Reviews, string AdditionalDetails, CampaignConcept? Concept, string? ParentCampaignTitle,
    CampaignAssignmentView[] Assignments, DateTimeOffset? OperationsConfirmedAt,
    DateTimeOffset? BudgetConfirmedAt, bool BudgetNeedsReview, Guid? FinalSubmissionId, PublicCampaignPlan? PublicPlan)
{
    public string Code => $"GA-{Id:N}";
}
