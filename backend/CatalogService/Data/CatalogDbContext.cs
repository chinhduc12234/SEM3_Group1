using CatalogService.Models;
using Microsoft.EntityFrameworkCore;

namespace CatalogService.Data;

public sealed class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Product>().Property(x => x.Name).HasMaxLength(160);
        model.Entity<Product>().Property(x => x.Description).HasMaxLength(2000);
        model.Entity<Product>().Property(x => x.Category).HasMaxLength(80);
        model.Entity<Product>().Property(x => x.Price).HasPrecision(18, 2);
        model.Entity<Product>().HasIndex(x => new { x.IsPublished, x.CreatedAt });
    }
}
