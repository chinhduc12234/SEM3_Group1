using System.ComponentModel.DataAnnotations;
using OrganizationService.Data;

namespace OrganizationService.Contracts;

// Only editable profile fields are accepted; status, ownership and membership are server controlled.
public sealed record OrganizationRequest([Required] OrganizationProfile Profile,
    [Required, StringLength(30, MinimumLength = 6)] string IdentityNumber, bool Consent, string? Version);
public sealed record VersionRequest([Required] string Version);
public sealed record ReviewRequest([Required, RegularExpression("^(APPROVE|REJECT|REQUEST_CHANGES)$")] string Decision,
    [MaxLength(2000)] string Reason, [Required] string Version);
