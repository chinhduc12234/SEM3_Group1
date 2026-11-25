using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CampaignService.Data;

public sealed class Campaign
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid CreatedBy { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string CampaignType { get; set; } = "COMBINED";
    public string Cause { get; set; } = "";
    public string BeneficiaryDescription { get; set; } = "";
    public decimal GoalAmount { get; set; }
    public int VolunteerTarget { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string Location { get; set; } = "";
    public string ContactEmail { get; set; } = "";
    public string ContactPhone { get; set; } = "";
    public string AdditionalDetails { get; set; } = "{}";
    public string? ConceptDetails { get; set; }
    public Guid? ParentCampaignId { get; set; }
    public Campaign? ParentCampaign { get; set; }
    public string Status { get; set; } = "DRAFT";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public Guid? StartedBy { get; set; }
    public Guid? StartedSubmissionId { get; set; }
    public string? LaunchConfirmations { get; set; }
    public byte[] Version { get; set; } = [];
    public List<CampaignReview> Reviews { get; set; } = [];
    public List<CampaignMedia> Media { get; set; } = [];
    public List<CampaignAssignment> Assignments { get; set; } = [];
    public string? OperationsPlan { get; set; }
    public DateTimeOffset? OperationsConfirmedAt { get; set; }
    public Guid? OperationsConfirmedBy { get; set; }
    public string? BudgetPlan { get; set; }
    public DateTimeOffset? BudgetConfirmedAt { get; set; }
    public bool BudgetNeedsReview { get; set; }
}
public sealed class CampaignAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public Guid UserId { get; set; }
    public Guid MembershipId { get; set; }
    public string FullName { get; set; } = "";
    public string Role { get; set; } = "";
    public bool IsPrimary { get; set; }
    public Guid AssignedBy { get; set; }
    public DateTimeOffset AssignedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
public sealed class CampaignNotification
{
    public Guid Id { get; set; }
    public string Payload { get; set; } = "";
    public DateTimeOffset NextAttemptAt { get; set; }
    public int Attempts { get; set; }
}
public sealed class CampaignReview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public Guid ActorId { get; set; }
    public string Action { get; set; } = "";
    public string Note { get; set; } = "";
    public string? SubmittedSnapshot { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class CampaignMedia
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public string Kind { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public byte[] Content { get; set; } = [];
    public string? StoragePath { get; set; }
}
public sealed class CampaignDb(DbContextOptions<CampaignDb> options) : DbContext(options)
{
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<CampaignReview> Reviews => Set<CampaignReview>();
    public DbSet<CampaignMedia> Media => Set<CampaignMedia>();
    public DbSet<CampaignNotification> AssignmentNotifications => Set<CampaignNotification>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        var c = b.Entity<Campaign>();
        c.HasIndex(x => new { x.OrganizationId, x.Status });
        c.HasIndex(x => new { x.Status, x.StartDate, x.EndDate });
        c.Property(x => x.Version).IsRowVersion();
        c.Property(x => x.GoalAmount).HasPrecision(18, 2);
        c.Property(x => x.CampaignType).HasMaxLength(20);
        c.Property(x => x.Status).HasMaxLength(30);
        c.Property(x => x.Title).HasMaxLength(200);
        c.Property(x => x.Description).HasMaxLength(10000);
        c.Property(x => x.Cause).HasMaxLength(50);
        c.Property(x => x.BeneficiaryDescription).HasMaxLength(4000);
        c.Property(x => x.Location).HasMaxLength(400);
        c.Property(x => x.ContactEmail).HasMaxLength(256);
        c.Property(x => x.ContactPhone).HasMaxLength(25);
        c.Property(x => x.AdditionalDetails).HasColumnType("nvarchar(max)");
        c.HasMany(x => x.Reviews).WithOne().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);
        c.HasMany(x => x.Media).WithOne().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);
        c.HasOne(x => x.ParentCampaign).WithMany().HasForeignKey(x => x.ParentCampaignId).OnDelete(DeleteBehavior.Restrict);
        c.HasMany(x => x.Assignments).WithOne().HasForeignKey(x => x.CampaignId);
        b.Entity<CampaignAssignment>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<CampaignAssignment>().Property(x => x.Role).HasMaxLength(32);
        b.Entity<CampaignAssignment>().Property(x => x.FullName).HasMaxLength(200);
        b.Entity<CampaignAssignment>().HasIndex(x => new { x.UserId, x.MembershipId, x.RevokedAt });
        b.Entity<CampaignNotification>().HasIndex(x => x.NextAttemptAt);
        b.Entity<CampaignReview>().Property(x => x.Action).HasMaxLength(30);
        b.Entity<CampaignReview>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<CampaignMedia>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<CampaignReview>().Property(x => x.Note).HasMaxLength(2000);
        b.Entity<CampaignMedia>().Property(x => x.Kind).HasMaxLength(20);
        b.Entity<CampaignMedia>().Property(x => x.FileName).HasMaxLength(200);
        b.Entity<CampaignMedia>().Property(x => x.StoragePath).HasMaxLength(200);
        b.Entity<CampaignMedia>().Property(x => x.ContentType).HasMaxLength(60);
    }
}
public sealed class CampaignDbFactory : IDesignTimeDbContextFactory<CampaignDb>
{
    public CampaignDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<CampaignDb>()
        .UseSqlServer("Server=localhost;Database=GiveAid_Campaign;Integrated Security=True;TrustServerCertificate=True").Options);
}
