using System.ComponentModel.DataAnnotations;

namespace OrganizationService.Contracts;

public sealed record WorkspaceRequest(
    [Required, StringLength(200, MinimumLength = 3)] string DisplayName,
    [Required, StringLength(4000, MinimumLength = 30)] string Introduction,
    [Required, StringLength(4000, MinimumLength = 30)] string Mission,
    [Required, MinLength(1), MaxLength(8)] string[] FocusAreas,
    [Required, EmailAddress, MaxLength(256)] string ContactEmail,
    [Required, RegularExpression(@"^\+?[0-9 ()-]{8,25}$")] string ContactPhone,
    [MaxLength(300)] string Website,
    [Required, StringLength(400, MinimumLength = 10)] string Address,
    [Required] string Version);
public sealed record InviteMemberRequest([Required, EmailAddress, MaxLength(256)] string Email, [Required, MinLength(1), MaxLength(5)] string[] Roles);
public sealed record MemberRolesRequest([Required, MinLength(1), MaxLength(5)] string[] Roles, [Required] string Version);
public sealed record MemberStateRequest(bool IsActive, [Required] string Version);
public sealed record InvitationResponseRequest(bool Accept, [Required] string Version);
public sealed record LegalChangeReviewRequest([Required, RegularExpression("^(APPROVE|REJECT)$")] string Decision,
    [Required, StringLength(2000, MinimumLength = 3)] string Reason, [Required] string Version);
