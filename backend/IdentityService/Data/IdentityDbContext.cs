using IdentityService.Models;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Data;

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();
    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>().HasIndex(x => x.Email).IsUnique();
        model.Entity<User>().Property(x => x.Email).HasMaxLength(254);
        model.Entity<User>().Property(x => x.DisplayName).HasMaxLength(100);
        model.Entity<User>().Property(x => x.Role).HasMaxLength(20);
        model.Entity<User>().Property(x => x.RowVersion).IsRowVersion();
        model.Entity<RefreshSession>().HasIndex(x => x.TokenHash).IsUnique();
        model.Entity<RefreshSession>().Property(x => x.TokenHash).HasMaxLength(64);
        model.Entity<RefreshSession>().Property(x => x.RowVersion).IsRowVersion();
        model.Entity<RefreshSession>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
    }
}
