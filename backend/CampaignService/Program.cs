using Shared;
using CampaignService.Data;
using CampaignService.Services;
using CampaignService.Repositories;
using Microsoft.EntityFrameworkCore;

// Campaign owns campaigns, beneficiaries and their review lifecycle.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<CampaignDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddScoped<ICampaignRepository, CampaignRepository>();
builder.Services.AddScoped<ICampaignApplication, CampaignApplication>();
builder.Services.AddScoped<IOrganizationAccess, OrganizationAccess>();
builder.Services.AddScoped<ISurveyRepository, SurveyRepository>();
builder.Services.AddScoped<ISurveyApplication, SurveyApplication>();
builder.Services.AddSingleton<ISurveyImageProcessor, SurveyImageProcessor>();
builder.Services.AddHttpClient("organization", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:OrganizationUrl"] ?? "http://organization:8080/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("X-Internal-Key", builder.Configuration["InternalApi:Key"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });

// Keep cross-service calls out of this bootstrap; use explicit API contracts or events as features arrive.
var app = builder.Build();
if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<CampaignDb>().Database.MigrateAsync();
    return;
}
app.UseApi();

// The liveness endpoint reports process health independently of downstream dependencies.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "campaigns" }));
app.MapGet("/health/ready", async (CampaignDb db) => await db.Database.CanConnectAsync() ? Results.Ok() : Results.StatusCode(503));
app.Run();
