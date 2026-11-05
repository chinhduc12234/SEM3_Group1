using Microsoft.EntityFrameworkCore;

namespace CampaignService.Data;

public sealed class SurveyReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? ManagerId { get; set; }
    public string Title { get; set; } = "";
    public string Province { get; set; } = "";
    public string Ward { get; set; } = "";
    public string AddressDetail { get; set; } = "";
    public string Category { get; set; } = "";
    public string Severity { get; set; } = "";
    public int? AffectedHouseholds { get; set; }
    public string Description { get; set; } = "";
    public string ProposedSupport { get; set; } = "";
    public DateOnly SurveyedAt { get; set; }
    public string Status { get; set; } = "DRAFT";
    public string? ReviewNote { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsDeleted { get; set; }
    public byte[] Version { get; set; } = [];
    public List<SurveyReportImage> Images { get; set; } = [];
    public List<SurveyReportEvent> Events { get; set; } = [];
}
public sealed class SurveyReportImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReportId { get; set; }
    public string FileReference { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "image/jpeg";
    public long FileSize { get; set; }
    public byte[] Content { get; set; } = [];
    public Guid UploadedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class SurveyReportEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReportId { get; set; }
    public Guid ActorId { get; set; }
    public string Action { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class SurveyNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReportId { get; set; }
    public Guid RecipientId { get; set; }
    public string Message { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReadAt { get; set; }
}
public static class SurveySchema
{
    public static void Configure(ModelBuilder b)
    {
        var r = b.Entity<SurveyReport>();
        r.ToTable("SurveyReports", t => t.HasCheckConstraint("CK_SurveyReports_Households", "[AffectedHouseholds] IS NULL OR [AffectedHouseholds] >= 0"));
        r.Property(x => x.Title).HasMaxLength(255);
        r.Property(x => x.Province).HasMaxLength(150);
        r.Property(x => x.Ward).HasMaxLength(150);
        r.Property(x => x.AddressDetail).HasMaxLength(1000);
        r.Property(x => x.Category).HasMaxLength(50);
        r.Property(x => x.Severity).HasMaxLength(30);
        r.Property(x => x.Description).HasMaxLength(10000);
        r.Property(x => x.ProposedSupport).HasMaxLength(5000);
        r.Property(x => x.ReviewNote).HasMaxLength(2000);
        r.Property(x => x.Status).HasMaxLength(30);
        r.Property(x => x.Version).IsRowVersion();
        r.HasIndex(x => new { x.OrganizationId, x.StaffId, x.IsDeleted, x.Status });
        r.HasIndex(x => new { x.OrganizationId, x.ManagerId, x.IsDeleted, x.Status });
        r.HasMany(x => x.Images).WithOne().HasForeignKey(x => x.ReportId).OnDelete(DeleteBehavior.Restrict);
        r.HasMany(x => x.Events).WithOne().HasForeignKey(x => x.ReportId).OnDelete(DeleteBehavior.Restrict);
        var image = b.Entity<SurveyReportImage>();
        image.ToTable("SurveyReportImages");
        image.Property(x => x.Id).ValueGeneratedNever();
        image.Property(x => x.FileReference).HasMaxLength(500);
        image.Property(x => x.FileName).HasMaxLength(200);
        image.Property(x => x.ContentType).HasMaxLength(50);
        var e = b.Entity<SurveyReportEvent>();
        e.ToTable("SurveyReportEvents");
        e.Property(x => x.Id).ValueGeneratedNever();
        e.Property(x => x.Action).HasMaxLength(40);
        e.Property(x => x.Note).HasMaxLength(2000);
        var n = b.Entity<SurveyNotification>();
        n.ToTable("SurveyNotifications");
        n.Property(x => x.Message).HasMaxLength(2300);
        n.HasIndex(x => new { x.RecipientId, x.ReadAt });
        n.HasOne<SurveyReport>().WithMany().HasForeignKey(x => x.ReportId).OnDelete(DeleteBehavior.Restrict);
    }
}
