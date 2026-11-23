using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace DonationService.Data;

public sealed class DonationRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public Guid BudgetItemId { get; set; }
    public Guid DonorUserId { get; set; }
    public string DonorName { get; set; } = "";
    public string DonorEmail { get; set; } = "";
    public string CampaignTitle { get; set; } = "";
    public string TargetName { get; set; } = "";
    public string? PayerAccountLast4 { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "SIMULATED_QR";
    public string Status { get; set; } = "PENDING";
    public string Reference { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ConfirmedAt { get; set; }
}

public sealed class SandboxOtpChallenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DonationId { get; set; }
    public string CodeHash { get; set; } = "";
    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public int FailedAttempts { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
}

public sealed class DonationNotificationOutbox
{
    public Guid Id { get; set; }
    public string Payload { get; set; } = "";
    public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;
    public int Attempts { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
    public string? LastErrorCode { get; set; }
}

public sealed class DonationDb(DbContextOptions<DonationDb> options) : DbContext(options)
{
    public DbSet<DonationRecord> Donations => Set<DonationRecord>();
    public DbSet<SandboxOtpChallenge> SandboxOtpChallenges => Set<SandboxOtpChallenge>();
    public DbSet<DonationNotificationOutbox> NotificationOutbox => Set<DonationNotificationOutbox>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        var donation = b.Entity<DonationRecord>();
        donation.ToTable("Donations", t => t.HasCheckConstraint("CK_Donations_Amount", "[Amount] > 0"));
        donation.HasIndex(x => new { x.CampaignId, x.Status, x.BudgetItemId });
        donation.HasIndex(x => new { x.DonorUserId, x.CreatedAt });
        donation.HasIndex(x => x.Reference).IsUnique();
        donation.Property(x => x.DonorName).HasMaxLength(200);
        donation.Property(x => x.DonorEmail).HasMaxLength(320);
        donation.Property(x => x.CampaignTitle).HasMaxLength(200);
        donation.Property(x => x.TargetName).HasMaxLength(200);
        donation.Property(x => x.PayerAccountLast4).HasMaxLength(4);
        donation.Property(x => x.Amount).HasPrecision(18, 2);
        donation.Property(x => x.PaymentMethod).HasMaxLength(30);
        donation.Property(x => x.Status).HasMaxLength(20);
        donation.Property(x => x.Reference).HasMaxLength(40);
        var otp = b.Entity<SandboxOtpChallenge>();
        otp.HasIndex(x => x.DonationId).IsUnique();
        otp.Property(x => x.CodeHash).HasMaxLength(64);
        var outbox = b.Entity<DonationNotificationOutbox>();
        outbox.HasIndex(x => x.NextAttemptAt);
        outbox.Property(x => x.Payload).HasColumnType("nvarchar(max)");
        outbox.Property(x => x.LastErrorCode).HasMaxLength(80);
    }
}

public sealed class DonationDbFactory : IDesignTimeDbContextFactory<DonationDb>
{
    public DonationDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<DonationDb>()
        .UseSqlServer("Server=localhost;Database=GiveAid_Donation;Integrated Security=True;TrustServerCertificate=True").Options);
}
