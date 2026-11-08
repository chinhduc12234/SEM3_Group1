using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using NotificationService.Models;

namespace NotificationService.Data;

public sealed class NotificationDb(DbContextOptions<NotificationDb> options) : DbContext(options)
{
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<ReceivedEvent> ReceivedEvents => Set<ReceivedEvent>();
    public DbSet<PushSubscription> Subscriptions => Set<PushSubscription>();
    public DbSet<PushDelivery> Deliveries => Set<PushDelivery>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Notification>().HasIndex(x => new { x.EventId, x.UserId }).IsUnique();
        b.Entity<Notification>().HasIndex(x => new { x.UserId, x.CreatedAt, x.Id });
        b.Entity<Notification>().HasIndex(x => new { x.UserId, x.ReadAt });
        b.Entity<Notification>().HasIndex(x => x.BroadcastAt);
        b.Entity<Notification>().Property(x => x.Kind).HasMaxLength(40);
        b.Entity<Notification>().Property(x => x.Title).HasMaxLength(150);
        b.Entity<Notification>().Property(x => x.Message).HasMaxLength(500);
        b.Entity<Notification>().Property(x => x.Url).HasMaxLength(200);
        b.Entity<ReceivedEvent>().Property(x => x.PayloadHash).HasMaxLength(64);
        b.Entity<PushSubscription>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<PushSubscription>().HasIndex(x => new { x.UserId, x.SessionId, x.IsActive });
        b.Entity<PushSubscription>().Property(x => x.TokenHash).HasMaxLength(64);
        b.Entity<PushSubscription>().Property(x => x.ProtectedToken).HasMaxLength(6000);
        b.Entity<PushDelivery>().HasIndex(x => new { x.NotificationId, x.SubscriptionId }).IsUnique();
        b.Entity<PushDelivery>().HasIndex(x => new { x.State, x.NextAttemptAt });
        b.Entity<PushDelivery>().HasOne(x => x.Notification).WithMany().HasForeignKey(x => x.NotificationId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<PushDelivery>().HasOne(x => x.Subscription).WithMany().HasForeignKey(x => x.SubscriptionId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<PushDelivery>().Property(x => x.State).HasMaxLength(20);
        b.Entity<PushDelivery>().Property(x => x.LastErrorCode).HasMaxLength(80);
    }
}

public sealed class NotificationDbFactory : IDesignTimeDbContextFactory<NotificationDb>
{
    public NotificationDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<NotificationDb>()
        .UseSqlServer("Server=localhost;Database=GiveAid_Notification;Integrated Security=True;TrustServerCertificate=True").Options);
}
