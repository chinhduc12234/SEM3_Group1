using System.ComponentModel.DataAnnotations;

namespace CampaignService.Contracts;

public sealed class SurveyRequest
{
    [Required, StringLength(255, MinimumLength = 3)] public string Title { get; set; } = "";
    [Required, StringLength(150, MinimumLength = 2)] public string Province { get; set; } = "";
    [Required, StringLength(150, MinimumLength = 2)] public string Ward { get; set; } = "";
    [Required, StringLength(1000, MinimumLength = 5)] public string AddressDetail { get; set; } = "";
    [Required, RegularExpression("^(FOOD|WATER|HOUSING|EDUCATION|HEALTH|LIVELIHOOD|DISASTER|OTHER)$")] public string Category { get; set; } = "";
    [Required, RegularExpression("^(LOW|MEDIUM|HIGH|CRITICAL)$")] public string Severity { get; set; } = "";
    [Range(0, 1000000)] public int? AffectedHouseholds { get; set; }
    [Required, StringLength(10000, MinimumLength = 30)] public string Description { get; set; } = "";
    [Required, StringLength(5000, MinimumLength = 10)] public string ProposedSupport { get; set; } = "";
    public DateOnly SurveyedAt { get; set; }
    public string Version { get; set; } = "";
}
public sealed record SurveyReviewRequest([Required] string Version,
    [Required, RegularExpression("^(APPROVE|REQUEST_CHANGES|REJECT)$")] string Decision, [MaxLength(2000)] string Note = "");
