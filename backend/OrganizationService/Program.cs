using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using OrganizationService.Services;
using Shared;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<OrganizationDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddOptions<EmailOptions>().BindConfiguration("EmailJS")
    .Validate(o => o.IsValid(), "Configure EmailJS credentials, templates, support email and a valid website URL.")
    .Validate(o => !o.Enabled || (builder.Configuration["InternalApi:Key"]?.Length ?? 0) >= 32,
        "Configure InternalApi:Key with at least 32 characters for account recipient lookup.").ValidateOnStart();
builder.Services.AddScoped<OrganizationEmailQueue>();
builder.Services.AddScoped<OrganizationNotificationQueue>();
builder.Services.AddHttpClient("notifications", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Notifications:Url"] ?? "http://notification:8080/");
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.Add("X-Internal-Key", builder.Configuration["InternalApi:Key"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddScoped<OrganizationApplications>();
builder.Services.AddScoped<OrganizationWorkspaceService>();
builder.Services.AddScoped<OrganizationMembers>();
builder.Services.AddScoped<OrganizationInvitations>();
builder.Services.AddScoped<OrganizationLegalChanges>();
builder.Services.AddScoped<OrganizationOversight>();
builder.Services.AddScoped<OwnerProfileDirectory>();
builder.Services.AddScoped<EmailNotificationService>();
builder.Services.AddScoped<WorkspaceAccess>();
builder.Services.AddScoped<IdentityDirectory>();
builder.Services.AddScoped<EmailDelivery>();
builder.Services.AddHttpClient("emailjs", client =>
{
    client.BaseAddress = new Uri("https://api.emailjs.com/");
    client.Timeout = TimeSpan.FromSeconds(20);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddHttpClient("identity-notifications", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:IdentityUrl"] ?? "http://identity:8080/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("X-Internal-Key", builder.Configuration["InternalApi:Key"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
if (!args.Contains("--migrate"))
{
    builder.Services.AddHostedService<EmailOutboxWorker>();
    builder.Services.AddHostedService<NotificationEventWorker>();
}
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
