using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NotificationService.Data;
using NotificationService.Realtime;
using NotificationService.Repositories;
using NotificationService.Services;
using Shared;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApi(builder.Configuration);
builder.Services.AddDbContext<NotificationDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddOptions<FirebaseOptions>().BindConfiguration("Firebase").Validate(x => x.IsValid(), "Configure Firebase web settings, credentials and website origin.").ValidateOnStart();
builder.Services.AddOptions<InternalOptions>().BindConfiguration("InternalApi").Validate(x => x.Key.Length >= 32, "Configure InternalApi:Key (32+ characters).").ValidateOnStart();
builder.Services.AddScoped<NotificationRepository>();
builder.Services.AddScoped<NotificationInbox>();
builder.Services.AddScoped<OrganizationEventReceiver>();
builder.Services.AddSingleton<IPushSender, FirebasePushSender>();
builder.Services.AddSingleton<IUserIdProvider, NotificationUserIdProvider>();
builder.Services.AddSignalR().AddStackExchangeRedis(builder.Configuration.GetConnectionString("Redis")!, options =>
    options.Configuration.ChannelPrefix = StackExchange.Redis.RedisChannel.Literal("GiveAid.Notifications"));
builder.Services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
{
    options.Events.OnMessageReceived = context =>
    {
        if (context.Request.Path == "/hubs/notifications") context.Token = context.Request.Query["access_token"];
        return Task.CompletedTask;
    };
});
builder.Services.AddHttpClient("identity", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["InternalApi:IdentityUrl"] ?? "http://identity:8080/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("X-Internal-Key", builder.Configuration["InternalApi:Key"]);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddDataProtection().SetApplicationName("GiveAid.Notification").PersistKeysToFileSystem(
    new DirectoryInfo(builder.Configuration["Protection:KeyDirectory"] ?? Path.Combine(builder.Environment.ContentRootPath, ".keys")));
if (!args.Contains("--migrate")) builder.Services.AddHostedService<NotificationDeliveryWorker>();
// Never log websocket query credentials (including development request logging).
builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
var app = builder.Build();
if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<NotificationDb>().Database.MigrateAsync();
    return;
}
if (app.Services.GetRequiredService<IOptions<FirebaseOptions>>().Value.Enabled) _ = app.Services.GetRequiredService<IPushSender>();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/hubs/notifications"))
    {
        var origin = context.Request.Headers.Origin.ToString();
        var allowed = app.Services.GetRequiredService<IOptions<FirebaseOptions>>().Value.WebsiteUrl.TrimEnd('/');
        if ((!string.IsNullOrEmpty(origin) && !string.Equals(origin, allowed, StringComparison.OrdinalIgnoreCase)) || context.Request.Headers["Sec-Fetch-Site"] == "cross-site")
        { context.Response.StatusCode = 403; return; }
    }
    await next();
});
app.UseApi();
app.MapHub<NotificationHub>("/hubs/notifications", options => options.CloseOnAuthenticationExpiration = true).RequireRateLimiting("organization");
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy", service = "notifications" }));
app.MapGet("/health/ready", async (NotificationDb db) => await db.Database.CanConnectAsync() ? Results.Ok() : Results.StatusCode(503));
app.Run();

public sealed class InternalOptions { public string Key { get; set; } = ""; }
