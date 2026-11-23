using Shared;
using DonationService.Data;
using DonationService.Services;
using Microsoft.EntityFrameworkCore;

// Donation owns mock payment records and financial entries; it never stores card verification data.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<DonationDb>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddScoped<CampaignDonationClient>();
builder.Services.AddScoped<DonationAccountDirectory>();
builder.Services.AddScoped<DonationSandboxPaymentService>();
builder.Services.AddHttpClient("campaign-internal", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:CampaignUrl"] ?? "http://campaign:8080/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("X-Internal-Key", builder.Configuration["InternalApi:Key"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddHttpClient("identity-internal", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:IdentityUrl"] ?? "http://identity:8080/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("X-Internal-Key", builder.Configuration["InternalApi:Key"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddHttpClient("notifications", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:NotificationUrl"] ?? "http://notification:8080/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("X-Internal-Key", builder.Configuration["InternalApi:Key"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
if (!args.Contains("--migrate")) builder.Services.AddHostedService<DonationNotificationOutboxWorker>();

// Payment processing remains a replaceable adapter behind this service boundary.
var app = builder.Build();
if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<DonationDb>().Database.MigrateAsync();
    return;
}
app.UseApi();

// The liveness endpoint reports process health independently of downstream dependencies.
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "donations" }));
app.MapGet("/health/ready", async (DonationDb db) => await db.Database.CanConnectAsync() ? Results.Ok() : Results.StatusCode(503));
app.Run();
