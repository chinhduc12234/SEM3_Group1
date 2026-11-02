using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using Shared;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<OrganizationDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
// Keep these keys across deployments and backups; losing them makes encrypted legal records unreadable.
builder.Services.AddDataProtection().SetApplicationName("GiveAid.Organization")
    .PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["Protection:KeyDirectory"] ?? Path.Combine(builder.Environment.ContentRootPath, ".keys")));
var app = builder.Build();
if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<OrganizationDb>().Database.MigrateAsync();
    return;
}
app.UseApi();
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "organizations" }));
app.MapGet("/health/ready", async (OrganizationDb db) => await db.Database.CanConnectAsync() ? Results.Ok() : Results.StatusCode(503));
app.Run();
