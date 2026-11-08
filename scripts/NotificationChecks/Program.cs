using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NotificationService.Contracts;
using NotificationService.Data;
using NotificationService.Models;
using NotificationService.Realtime;
using NotificationService.Repositories;
using NotificationService.Services;
using Shared;
using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Notification = NotificationService.Models.Notification;

if (args.Contains("--validate-firebase"))
{
    var path = Environment.GetEnvironmentVariable("FIREBASE_TEST_CREDENTIAL") ?? throw new InvalidOperationException("Set FIREBASE_TEST_CREDENTIAL.");
    var credential = CredentialFactory.FromFile<ServiceAccountCredential>(path);
    var app = FirebaseApp.Create(new AppOptions { Credential = GoogleCredential.FromServiceAccountCredential(credential), ProjectId = credential.ProjectId });
    try
    {
#pragma warning disable CS0618
        await FirebaseMessaging.GetMessaging(app).SendAsync(new Message { Token = "synthetic-invalid-registration-token", Notification = new FirebaseAdmin.Messaging.Notification { Title = "Validation only", Body = "Dry run" } }, true);
#pragma warning restore CS0618
        throw new Exception("Expected the synthetic token to be rejected.");
    }
    catch (FirebaseMessagingException ex) when (ex.MessagingErrorCode == MessagingErrorCode.InvalidArgument)
    { Console.WriteLine("PASS: Firebase authenticated dry-run reached FCM; synthetic token rejected as expected. No device notification sent."); }
    finally { app.Delete(); }
    return;
}

var connectionString = Environment.GetEnvironmentVariable("NOTIFICATION_TEST_DATABASE")
    ?? throw new InvalidOperationException("Set NOTIFICATION_TEST_DATABASE to the local notification database. Uses a fake provider, never sends actual push.");
var services = new ServiceCollection();
services.AddDbContext<NotificationDb>(o => o.UseSqlServer(connectionString));
services.AddDistributedMemoryCache();
services.AddSingleton<SessionStore>();
services.AddDataProtection().UseEphemeralDataProtectionProvider();
services.AddOptions<FirebaseOptions>().Configure(o => o.Enabled = true);
services.AddSingleton<IPushSender, FakePush>();
services.AddSingleton<IHubContext<NotificationHub>, FakeHub>();
await using var provider = services.BuildServiceProvider();
var user = Guid.NewGuid(); var sid = Guid.NewGuid(); var org = Guid.NewGuid();
var actor = new NotificationActor(user, sid);
await provider.GetRequiredService<SessionStore>().Activate(sid, user, DateTimeOffset.UtcNow.AddHours(1));
var sender = (FakePush)provider.GetRequiredService<IPushSender>();
var worker = new NotificationDeliveryWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<NotificationDeliveryWorker>.Instance);
var protector = provider.GetRequiredService<IDataProtectionProvider>().CreateProtector("GiveAid.Notification.PushToken.v1");
var assertions = 0;
void Check(bool value, string message) { if (!value) throw new Exception(message); assertions++; }
async Task Drain()
{
    for (var i = 0; i < 100 && await worker.ProcessOne(default); i++) { }
}
try
{
    // Only this test's work should be pending while running this local worker suite.
    await using var scope = provider.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<NotificationDb>();
    if (await db.Notifications.AnyAsync(x => x.BroadcastAt == null) || await db.Deliveries.AnyAsync(x => x.State == "PENDING"))
        throw new InvalidOperationException("Wait for existing notification deliveries before running isolated fake-provider checks.");
    var repository = new NotificationRepository(db);
    await repository.Subscribe(actor, user.ToString("N"), protector.Protect("fake-device-token"), default);
    var subscription = await db.Subscriptions.SingleAsync(x => x.UserId == user);
    async Task<PushDelivery> Queue()
    {
        var notification = new Notification { EventId = Guid.NewGuid(), OrganizationId = org, UserId = user, Kind = "APPROVE", Title = "Synthetic push", Message = "Synthetic test", Url = "/notifications" };
        var delivery = new PushDelivery { Notification = notification, SubscriptionId = subscription.Id, UserId = user, SessionId = sid };
        db.Notifications.Add(notification); db.Deliveries.Add(delivery); await db.SaveChangesAsync();
        return delivery;
    }
    async Task Reload(PushDelivery d) { db.ChangeTracker.Clear(); await db.Entry(d).ReloadAsync(); }
    var success = await Queue(); await Drain(); await Reload(success);
    Check(success.State == "SENT" && success.Attempts == 1 && sender.Sends == 1, "Successful delivery must persist once");
    await Drain(); Check(sender.Sends == 1, "Accepted delivery must not be sent again");

    var read = await Queue();
    await repository.Read(user, read.NotificationId, default); await Drain(); await Reload(read);
    Check(read.State == "SKIPPED" && sender.Sends == 1, "Read notification must not produce push");
    Check(!await repository.Read(Guid.NewGuid(), success.NotificationId, default), "Cross-user read must fail");
    Check((await repository.List(Guid.NewGuid(), 1, false, default)).TotalCount == 0, "Inbox must be scoped");

    sender.Fail = true;
    var retry = await Queue(); await Drain(); await Reload(retry);
    Check(retry.State == "PENDING" && retry.Attempts == 1 && retry.LastErrorCode == "PROVIDER_UNAVAILABLE", "Transient failure must be retried");
    sender.Fail = false;
    await db.Deliveries.Where(x => x.Id == retry.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.NextAttemptAt, DateTimeOffset.UtcNow.AddSeconds(-1)));
    await Drain(); await Reload(retry);
    Check(retry.State == "SENT" && retry.Attempts == 2, "Retry must recover");

    sender.Fail = true;
    var exhausted = await Queue();
    await db.Deliveries.Where(x => x.Id == exhausted.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.Attempts, 9));
    await Drain(); await Reload(exhausted);
    Check(exhausted.State == "FAILED" && exhausted.Attempts == 10, "Retry exhaustion must remain inspectable");
    sender.Fail = false;

    var switched = await Queue();
    await db.Subscriptions.Where(x => x.Id == subscription.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, Guid.NewGuid()));
    await Drain(); await Reload(switched); Check(switched.State == "SKIPPED", "Changed browser ownership must skip old delivery");
    await db.Subscriptions.Where(x => x.Id == subscription.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, user));

    var disabled = await Queue();
    await repository.Unsubscribe(actor, default); await Drain(); await Reload(disabled);
    Check(disabled.State == "SKIPPED", "Disabled subscription must not receive push");
    await db.Subscriptions.Where(x => x.Id == subscription.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsActive, true).SetProperty(x => x.ProtectedToken, "broken-ciphertext"));
    var crypto = await Queue(); await Drain(); await Reload(crypto);
    Check(crypto.State == "FAILED" && crypto.LastErrorCode == "TOKEN_DECRYPTION_FAILED", "Lost keys must fail without leaking token");
    await db.Subscriptions.Where(x => x.Id == subscription.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.ProtectedToken, protector.Protect("fake-device-token")));

    var revoked = await Queue();
    await provider.GetRequiredService<SessionStore>().Revoke(sid); await Drain(); await Reload(revoked);
    Check(revoked.State == "SKIPPED", "Revoked login session must not receive push");
    Check(!await db.Subscriptions.AsNoTracking().Where(x => x.Id == subscription.Id).Select(x => x.IsActive).SingleAsync(), "Revoked subscription must be invalidated");
    Console.WriteLine($"PASS: {assertions} SQL worker assertions with fake push; success, retries, exhaustion, isolation, read/disabled/revoked/switched sessions and corrupted token.");
}
finally
{
    await using var scope = provider.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<NotificationDb>();
    await db.Notifications.Where(x => x.OrganizationId == org).ExecuteDeleteAsync();
    await db.Subscriptions.Where(x => x.TokenHash == user.ToString("N")).ExecuteDeleteAsync();
}

sealed class FakePush : IPushSender
{
    public bool Fail { get; set; }
    public int Sends { get; private set; }
    public Task Send(string token, Guid id, CancellationToken ct)
    {
        if (Fail) throw new HttpRequestException("Synthetic failure");
        if (token != "fake-device-token") throw new Exception("Unexpected token");
        Sends++; return Task.CompletedTask;
    }
}
sealed class FakeClient : IClientProxy
{
    public Task SendCoreAsync(string method, object?[] args, CancellationToken ct = default) => Task.CompletedTask;
}
sealed class FakeClients : IHubClients
{
    private readonly IClientProxy client = new FakeClient();
    public IClientProxy All => client;
    public IClientProxy AllExcept(IReadOnlyList<string> excluded) => client;
    public IClientProxy Client(string id) => client;
    public IClientProxy Clients(IReadOnlyList<string> ids) => client;
    public IClientProxy Group(string name) => client;
    public IClientProxy GroupExcept(string name, IReadOnlyList<string> excluded) => client;
    public IClientProxy Groups(IReadOnlyList<string> names) => client;
    public IClientProxy User(string user) => client;
    public IClientProxy Users(IReadOnlyList<string> users) => client;
}
sealed class FakeGroups : IGroupManager
{
    public Task AddToGroupAsync(string connection, string group, CancellationToken ct = default) => Task.CompletedTask;
    public Task RemoveFromGroupAsync(string connection, string group, CancellationToken ct = default) => Task.CompletedTask;
}
sealed class FakeHub : IHubContext<NotificationHub>
{
    public IHubClients Clients { get; } = new FakeClients();
    public IGroupManager Groups { get; } = new FakeGroups();
}
