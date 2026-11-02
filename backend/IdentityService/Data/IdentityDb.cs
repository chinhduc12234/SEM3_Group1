using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace IdentityService.Data;

public sealed class Account : IdentityUser<Guid>
{
    public string FullName { get; set; } = "";
    public bool IsActive { get; set; } = true;
}
public sealed class RefreshSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Account User { get; set; } = null!;
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public bool Revoked { get; set; }
    public byte[] Version { get; set; } = [];
}

// Identity owns standard ASP.NET Identity tables and hashed refresh-session records.
public sealed class IdentityDb(DbContextOptions<IdentityDb> options) : IdentityDbContext<Account, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Account>().Property(x => x.FullName).HasMaxLength(200);
        b.Entity<Account>().HasIndex(x => x.NormalizedEmail).IsUnique().HasFilter("[NormalizedEmail] IS NOT NULL");
        b.Entity<RefreshSession>().Property(x => x.TokenHash).HasMaxLength(64);
        b.Entity<RefreshSession>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<RefreshSession>().Property(x => x.Version).IsRowVersion();
        b.Entity<RefreshSession>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
    }
}
// Design-time migration generation does not start the API or require JWT keys.
public sealed class IdentityDbFactory : IDesignTimeDbContextFactory<IdentityDb>
{
    public IdentityDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<IdentityDb>()
        .UseSqlServer("Server=localhost;Database=GiveAid_Identity;Integrated Security=True;TrustServerCertificate=True").Options);
}
