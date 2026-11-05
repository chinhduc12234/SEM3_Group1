using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace OrganizationService.Data;

// This value object contains only applicant-editable fields, never ownership or review state.
public sealed class OrganizationProfile
{
    [Required, StringLength(200, MinimumLength = 3)] public string LegalName { get; set; } = "";
    [Required, RegularExpression("^(NGO|CHARITY|FOUNDATION|ASSOCIATION|SOCIAL_ENTERPRISE)$")] public string OrganizationType { get; set; } = "";
    [Required, StringLength(80, MinimumLength = 3)] public string RegistrationNumber { get; set; } = "";
    public DateOnly RegistrationDate { get; set; }
    [Required, StringLength(200, MinimumLength = 3)] public string RegistrationAuthority { get; set; } = "";
    public DateOnly FoundedDate { get; set; }
    [StringLength(30)] public string? TaxCode { get; set; }
    [Required, StringLength(400, MinimumLength = 10)] public string Address { get; set; } = "";
    [Required, StringLength(100, MinimumLength = 2)] public string Province { get; set; } = "";
    [Required, EmailAddress, MaxLength(256)] public string ContactEmail { get; set; } = "";
    [Required, RegularExpression(@"^\+?[0-9 ()-]{8,25}$")] public string ContactPhone { get; set; } = "";
    [StringLength(300)] public string? Website { get; set; }
    [Required, StringLength(4000, MinimumLength = 30)] public string Mission { get; set; } = "";
    [Required, StringLength(200, MinimumLength = 2)] public string RepresentativeName { get; set; } = "";
    [Required, StringLength(100, MinimumLength = 2)] public string RepresentativeTitle { get; set; } = "";
    public DateOnly RepresentativeBirthDate { get; set; }
    [Required, EmailAddress, MaxLength(256)] public string RepresentativeEmail { get; set; } = "";
    [Required, RegularExpression(@"^\+?[0-9 ()-]{8,25}$")] public string RepresentativePhone { get; set; } = "";
    [Required, RegularExpression("^(CCCD|PASSPORT)$")] public string IdentityType { get; set; } = "";
    public DateOnly IdentityIssuedDate { get; set; }
    [Required, StringLength(200, MinimumLength = 2)] public string IdentityIssuedBy { get; set; } = "";
}
public sealed class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ApplicantUserId { get; set; }
    public OrganizationProfile Profile { get; set; } = new();
    public string RegistrationKey { get; set; } = "";
    public string ProtectedIdentityNumber { get; set; } = "";
    public string Status { get; set; } = "DRAFT";
    public bool Consent { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SubmittedAt { get; set; }
    public byte[] Version { get; set; } = [];
    public List<OrganizationDocument> Documents { get; set; } = [];
    public List<OrganizationReview> Reviews { get; set; } = [];
}
public sealed class OrganizationDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public string Kind { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    public byte[] ProtectedContent { get; set; } = [];
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class OrganizationReview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid ActorUserId { get; set; }
    public string Action { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class OrganizationMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Organization Organization { get; set; } = null!;
    public Guid UserId { get; set; }
    public Guid? SurveyManagerUserId { get; set; }
    public string Role { get; set; } = "OWNER";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] Version { get; set; } = [];
    public List<OrganizationMemberRole> Roles { get; set; } = [];
}
// Only logical user IDs cross the service boundary; no Identity database reference exists here.
public sealed class OrganizationDb(DbContextOptions<OrganizationDb> options) : DbContext(options)
{
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationDocument> Documents => Set<OrganizationDocument>();
    public DbSet<OrganizationMember> Members => Set<OrganizationMember>();
    public DbSet<EmailNotification> EmailNotifications => Set<EmailNotification>();
    public DbSet<OrganizationWorkspace> Workspaces => Set<OrganizationWorkspace>();
    public DbSet<OrganizationInvitation> Invitations => Set<OrganizationInvitation>();
    public DbSet<OrganizationActivity> Activities => Set<OrganizationActivity>();
    public DbSet<OrganizationLegalChange> LegalChanges => Set<OrganizationLegalChange>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Organization>().OwnsOne(x => x.Profile);
        b.Entity<Organization>().Property(x => x.Version).IsRowVersion();
        b.Entity<Organization>().Property(x => x.RegistrationKey).HasMaxLength(80);
        b.Entity<Organization>().HasIndex(x => x.RegistrationKey).IsUnique();
        b.Entity<Organization>().Property(x => x.Status).HasMaxLength(30);
        b.Entity<Organization>().HasIndex(x => new { x.ApplicantUserId, x.CreatedAt });
        b.Entity<Organization>().HasMany(x => x.Documents).WithOne().HasForeignKey(x => x.OrganizationId);
        b.Entity<Organization>().HasMany(x => x.Reviews).WithOne().HasForeignKey(x => x.OrganizationId);
        b.Entity<OrganizationDocument>().Property(x => x.Kind).HasMaxLength(40);
        b.Entity<OrganizationDocument>().HasIndex(x => new { x.OrganizationId, x.Kind }).IsUnique();
        b.Entity<OrganizationDocument>().Property(x => x.FileName).HasMaxLength(120);
        b.Entity<OrganizationDocument>().Property(x => x.ContentType).HasMaxLength(80);
        b.Entity<OrganizationReview>().Property(x => x.Action).HasMaxLength(40);
        b.Entity<OrganizationReview>().Property(x => x.Reason).HasMaxLength(2000);
        b.Entity<OrganizationMember>().Property(x => x.Role).HasMaxLength(40);
        b.Entity<OrganizationMember>().HasIndex(x => new { x.OrganizationId, x.UserId }).IsUnique();
        b.Entity<EmailNotification>().Property(x => x.Sequence).UseIdentityColumn();
        b.Entity<EmailNotification>().HasIndex(x => x.Sequence).IsUnique();
        b.Entity<EmailNotification>().HasIndex(x => x.EventId).IsUnique();
        b.Entity<EmailNotification>().HasIndex(x => new { x.State, x.NextAttemptAt });
        b.Entity<EmailNotification>().HasIndex(x => new { x.OrganizationId, x.Sequence });
        b.Entity<EmailNotification>().Property(x => x.Action).HasMaxLength(40);
        b.Entity<EmailNotification>().Property(x => x.State).HasMaxLength(20);
        b.Entity<EmailNotification>().Property(x => x.LastErrorCode).HasMaxLength(80);
        b.Entity<EmailNotification>().HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId);
        b.Entity<OrganizationMember>().Property(x => x.Version).IsRowVersion();
        b.Entity<OrganizationMember>().HasMany(x => x.Roles).WithOne().HasForeignKey(x => x.MemberId);
        b.Entity<OrganizationMemberRole>().HasKey(x => new { x.MemberId, x.Role });
        b.Entity<OrganizationMemberRole>().Property(x => x.Role).HasMaxLength(40);
        b.Entity<OrganizationWorkspace>().HasKey(x => x.OrganizationId);
        b.Entity<OrganizationWorkspace>().HasOne<Organization>().WithOne().HasForeignKey<OrganizationWorkspace>(x => x.OrganizationId);
        b.Entity<OrganizationWorkspace>().Property(x => x.Version).IsRowVersion();
        b.Entity<OrganizationWorkspace>().Property(x => x.DisplayName).HasMaxLength(200);
        b.Entity<OrganizationInvitation>().HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId);
        b.Entity<OrganizationInvitation>().Property(x => x.State).HasMaxLength(20);
        b.Entity<OrganizationInvitation>().Property(x => x.Version).IsRowVersion();
        b.Entity<OrganizationInvitation>().HasIndex(x => new { x.OrganizationId, x.InvitedUserId }).IsUnique().HasFilter("[State] = 'PENDING'");
        b.Entity<OrganizationInvitation>().HasIndex(x => new { x.InvitedUserId, x.State });
        b.Entity<OrganizationActivity>().HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId);
        b.Entity<OrganizationActivity>().Property(x => x.Action).HasMaxLength(60);
        b.Entity<OrganizationActivity>().Property(x => x.Detail).HasMaxLength(2000);
        b.Entity<OrganizationActivity>().HasIndex(x => new { x.OrganizationId, x.At });
        b.Entity<OrganizationLegalChange>().HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId);
        b.Entity<OrganizationLegalChange>().Property(x => x.State).HasMaxLength(20);
        b.Entity<OrganizationLegalChange>().Property(x => x.Reason).HasMaxLength(2000);
        b.Entity<OrganizationLegalChange>().Property(x => x.ReviewReason).HasMaxLength(2000);
        b.Entity<OrganizationLegalChange>().Property(x => x.Version).IsRowVersion();
        b.Entity<OrganizationLegalChange>().HasIndex(x => x.OrganizationId).IsUnique().HasFilter("[State] = 'PENDING'");
        b.Entity<OrganizationLegalChange>().HasMany(x => x.Documents).WithOne().HasForeignKey(x => x.LegalChangeId);
        b.Entity<LegalChangeDocument>().Property(x => x.Kind).HasMaxLength(40);
        b.Entity<LegalChangeDocument>().Property(x => x.FileName).HasMaxLength(120);
        b.Entity<LegalChangeDocument>().Property(x => x.ContentType).HasMaxLength(80);
        b.Entity<LegalChangeDocument>().HasIndex(x => new { x.LegalChangeId, x.Kind }).IsUnique();
    }
}
public sealed class OrganizationDbFactory : IDesignTimeDbContextFactory<OrganizationDb>
{
    public OrganizationDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<OrganizationDb>()
        .UseSqlServer("Server=localhost;Database=GiveAid_Organization;Integrated Security=True;TrustServerCertificate=True").Options);
}
