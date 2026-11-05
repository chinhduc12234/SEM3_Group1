namespace OrganizationService.Data;

public sealed class OrganizationWorkspace
{
    public Guid OrganizationId { get; set; }
    public string DisplayName { get; set; } = "";
    public string Introduction { get; set; } = "";
    public string Mission { get; set; } = "";
    public string FocusAreasJson { get; set; } = "[]";
    public string ContactEmail { get; set; } = "";
    public string ContactPhone { get; set; } = "";
    public string Website { get; set; } = "";
    public string Address { get; set; } = "";
    public byte[]? ProtectedLogo { get; set; }
    public string? LogoType { get; set; }
    public byte[]? ProtectedCover { get; set; }
    public string? CoverType { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] Version { get; set; } = [];
}

public sealed class OrganizationMemberRole
{
    public Guid MemberId { get; set; }
    public string Role { get; set; } = "";
}

public sealed class OrganizationInvitation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid InvitedUserId { get; set; }
    public Guid InvitedBy { get; set; }
    public Guid? SurveyManagerUserId { get; set; }
    public string RolesJson { get; set; } = "[]";
    public string State { get; set; } = "PENDING";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddDays(7);
    public byte[] Version { get; set; } = [];
}

public sealed class OrganizationActivity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid ActorUserId { get; set; }
    public string Action { get; set; } = "";
    public string Detail { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class OrganizationLegalChange
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid RequestedBy { get; set; }
    public string ProtectedRequest { get; set; } = "";
    public string? ProtectedPreviousDossier { get; set; }
    public string Reason { get; set; } = "";
    public string State { get; set; } = "PENDING";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? ReviewedBy { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string ReviewReason { get; set; } = "";
    public byte[] Version { get; set; } = [];
    public List<LegalChangeDocument> Documents { get; set; } = [];
}

public sealed class LegalChangeDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LegalChangeId { get; set; }
    public string Kind { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public byte[] ProtectedContent { get; set; } = [];
}
