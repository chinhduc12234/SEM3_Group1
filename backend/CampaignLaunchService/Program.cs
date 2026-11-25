using CampaignLaunchService.Services;
using Shared;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddScoped<LaunchReadinessService>();
builder.Services.AddHttpClient("campaign", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:CampaignUrl"] ?? "http://campaign:8080/");
    client.Timeout = TimeSpan.FromSeconds(6);
    client.DefaultRequestHeaders.Add("X-Launch-Key", builder.Configuration["InternalApi:LaunchKey"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });

builder.Services.AddHttpClient("volunteer", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:VolunteerUrl"] ?? "http://volunteer:8080/");
    client.Timeout = TimeSpan.FromSeconds(6);
    client.DefaultRequestHeaders.Add("X-Launch-Key", builder.Configuration["InternalApi:LaunchKey"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });

builder.Services.AddHttpClient("donation", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:DonationUrl"] ?? "http://donation:8080/");
    client.Timeout = TimeSpan.FromSeconds(6);
    client.DefaultRequestHeaders.Add("X-Launch-Key", builder.Configuration["InternalApi:LaunchKey"] ?? "");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });

var app = builder.Build();
app.UseApi();
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "campaign-launch" }));
app.Run();
