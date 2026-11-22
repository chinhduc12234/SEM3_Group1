using Shared;
using Microsoft.EntityFrameworkCore;
using VolunteerService.Data;
using VolunteerService.Repositories;
using VolunteerService.Services;

// Volunteer owns registrations, assignments, tasks and attendance.
// CampaignService remains the source of campaign days, activities, teams and groups.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<VolunteerDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddScoped<IVolunteerRegistrationRepository, VolunteerRegistrationRepository>();
builder.Services.AddScoped<IVolunteerTaskRepository, VolunteerTaskRepository>();
builder.Services.AddScoped<IVolunteerRegistrationService, VolunteerRegistrationService>();
builder.Services.AddScoped<IVolunteerTaskService, VolunteerTaskService>();
builder.Services.AddScoped<ICampaignOpeningsClient, CampaignOpeningsClient>();
builder.Services.AddScoped<ICampaignReviewAccessClient, CampaignReviewAccessClient>();
builder.Services.AddScoped<ICampaignTaskAccessClient, CampaignTaskAccessClient>();
builder.Services.AddHttpClient("campaign", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:CampaignUrl"] ?? "http://campaign:8080/");
    client.Timeout = TimeSpan.FromSeconds(10);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddHttpClient("campaign-internal", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:CampaignUrl"] ?? "http://campaign:8080/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("X-Internal-Key", builder.Configuration["InternalApi:Key"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });

// Domain behavior is added inside this service instead of being spread across sibling services.
var app = builder.Build();
if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<VolunteerDb>().Database.MigrateAsync();
    return;
}
app.UseApi();

// The liveness endpoint reports process health independently of downstream dependencies.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "volunteers" }));
app.MapGet("/health/ready", async (VolunteerDb db) => await db.Database.CanConnectAsync() ? Results.Ok() : Results.StatusCode(503));
app.Run();
