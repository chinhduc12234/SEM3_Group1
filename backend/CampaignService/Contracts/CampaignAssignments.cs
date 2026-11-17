using System.ComponentModel.DataAnnotations;

namespace CampaignService.Contracts;

public sealed record CampaignAssignmentInput(Guid UserId, [Required] string Role, bool IsPrimary);
public sealed record CampaignAssignmentRequest([Required] string Version, [Required, MinLength(3), MaxLength(30)] CampaignAssignmentInput[] Assignments);
public sealed record CampaignAssignmentView(Guid UserId, string FullName, string Role, bool IsPrimary);
