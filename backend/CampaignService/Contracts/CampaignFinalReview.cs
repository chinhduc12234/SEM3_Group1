using System.ComponentModel.DataAnnotations;

namespace CampaignService.Contracts;

public sealed record FinalReviewRequest([Required] string Version, Guid SubmissionId,
    [Required, RegularExpression("^(APPROVE|REQUEST_CHANGES|REJECT)$")] string Decision,
    [MaxLength(2000)] string? Note, [RegularExpression("^(OPERATIONS|BUDGET|BOTH)$")] string? RevisionArea);

public sealed record PublicCampaignActivity(string Title, TimeOnly? Start, TimeOnly? End, string Location);
public sealed record PublicCampaignDay(Guid Id, DateOnly? Date, string Title, string Description, string Location,
    string? Province, string? District, string? Ward, OperationsMapPin? MapPin, PublicCampaignActivity[] Activities);
public sealed record PublicCampaignPlan(string Summary, string Goal, string Outcomes, string? EventFormat,
    string FundraisingPurpose, PublicCampaignDay[] Days);
