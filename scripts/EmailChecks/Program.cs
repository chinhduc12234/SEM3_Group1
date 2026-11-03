using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OrganizationService.Data;
using OrganizationService.Services;

// Deterministic delivery tests. All HTTP calls are intercepted: never send real emails.
var config = new EmailOptions
{
    Enabled = true, ServiceId = "test-service", PublicKey = "test-public", PrivateKey = "test-private",
    SubmittedTemplateId = "submitted", ReviewTemplateId = "review", SupportEmail = "support@example.test",
    WebsiteUrl = "http://localhost:8080"
};
Check(config.IsValid(), "valid config");
config.WebsiteUrl = "http://unsafe.example.test";
Check(!config.IsValid(), "reject insecure non-loopback URL");
config.WebsiteUrl = "http://localhost:8080";
var protection = DataProtectionProvider.Create("GiveAid.EmailTests");
var http = new FakeClients();
var services = new ServiceCollection();
services.AddSingleton<IDataProtectionProvider>(protection);
services.AddSingleton<IOptions<EmailOptions>>(Options.Create(config));
services.AddSingleton<IHttpClientFactory>(http);
services.AddScoped<EmailDelivery>();
var connection = Environment.GetEnvironmentVariable("EMAIL_TEST_DATABASE");
services.AddDbContext<OrganizationDb>(o => o.UseSqlServer(connection ?? "Server=unused;Database=unused;Integrated Security=True;TrustServerCertificate=True"));
using var provider = services.BuildServiceProvider();
using var scope = provider.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<OrganizationDb>();
var queue = new OrganizationEmailQueue(db, protection, Options.Create(config));
var organization = new Organization
{
    ApplicantUserId = Guid.NewGuid(), RegistrationKey = "EMAIL-TEST-" + Guid.NewGuid(),
    Profile = new OrganizationProfile { LegalName = "Email Test Organization", RepresentativeName = "Test Representative", RegistrationNumber = "EMAIL-TEST" },
    SubmittedAt = DateTimeOffset.Parse("2026-11-03T07:30:00Z")
};
var delivery = scope.ServiceProvider.GetRequiredService<EmailDelivery>();
foreach (var action in new[] { "SUBMITTED", "APPROVE", "REQUEST_CHANGES", "REJECT" })
{
    var review = new OrganizationReview { OrganizationId = organization.Id, Action = action, Reason = "Line one\nLine two <script>unsafe</script>", At = organization.SubmittedAt.Value };
    queue.Enqueue(organization, review);
    var item = db.ChangeTracker.Entries<EmailNotification>().Last().Entity;
    Check(!item.ProtectedPayload.Contains("Test Representative"), "encrypted payload");
    await delivery.Send(item, CancellationToken.None);
    var request = http.LastRequest!.Value;
    Check(request.GetProperty("template_id").GetString() == (action == "SUBMITTED" ? "submitted" : "review"), "template mapping");
    var parameters = request.GetProperty("template_params");
    Check(parameters.GetProperty("to_email").GetString() == "account@example.test", "identity account recipient");
    Check(http.LastIdentityPath!.Contains(organization.ApplicantUserId.ToString()), "applicant lookup, not admin");
    foreach (var (name, expected) in new[] { ("is_approved", action == "APPROVE"), ("is_changes_requested", action == "REQUEST_CHANGES"), ("is_rejected", action == "REJECT") })
        Check(parameters.GetProperty(name).GetBoolean() == expected, "boolean " + name);
    Check(parameters.GetProperty("review_reason").GetString() == review.Reason, "exact stored reason");
    Check(parameters.GetProperty("reviewed_at").GetString() == "03/11/2026 14:30:00 (UTC+7)", "Vietnam time");
    Check(parameters.GetProperty("application_url").GetString() == $"http://localhost:8080/organizations/{organization.Id}", "server-generated URL");
}
var sample = db.ChangeTracker.Entries<EmailNotification>().First().Entity;
http.EmailStatus = HttpStatusCode.ServiceUnavailable;
try { await delivery.Send(sample, CancellationToken.None); throw new Exception("Expected 503"); }
catch (EmailDeliveryException ex) { Check(!ex.Permanent && ex.Code == "EMAILJS_HTTP_503", "retry transient provider failure"); }
http.EmailStatus = HttpStatusCode.UnprocessableEntity;
try { await delivery.Send(sample, CancellationToken.None); throw new Exception("Expected 422"); }
catch (EmailDeliveryException ex) { Check(ex.Permanent && ex.Code == "EMAILJS_HTTP_422", "stop permanent provider failure"); }
http.IdentityStatus = HttpStatusCode.NotFound;
var before = http.Sends;
try { await delivery.Send(sample, CancellationToken.None); throw new Exception("Expected missing account"); }
catch (EmailDeliveryException ex) { Check(ex.Permanent && http.Sends == before, "missing account cannot send mail"); }
http.IdentityStatus = HttpStatusCode.OK;

if (connection is not null)
{
    db.ChangeTracker.Clear();
    db.Organizations.Add(organization);
    queue.Enqueue(organization, new OrganizationReview { Action = "SUBMITTED", OrganizationId = organization.Id });
    var queued = db.ChangeTracker.Entries<EmailNotification>().Single().Entity;
    await db.SaveChangesAsync();
    var worker = new EmailOutboxWorker(provider.GetRequiredService<IServiceScopeFactory>(), Options.Create(config), NullLogger<EmailOutboxWorker>.Instance);
    try
    {
        http.EmailStatus = HttpStatusCode.ServiceUnavailable;
        await worker.ProcessOne(CancellationToken.None);
        db.ChangeTracker.Clear();
        var failedAttempt = await db.EmailNotifications.SingleAsync(x => x.Id == queued.Id);
        Check(failedAttempt.State == "PENDING" && failedAttempt.Attempts == 1 && failedAttempt.NextAttemptAt > DateTimeOffset.UtcNow, "SQL retry/backoff");
        Check(!await worker.ProcessOne(CancellationToken.None), "respect retry schedule");
        failedAttempt.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();
        http.EmailStatus = HttpStatusCode.OK;
        var sends = http.Sends;
        await Task.WhenAll(worker.ProcessOne(CancellationToken.None), worker.ProcessOne(CancellationToken.None));
        db.ChangeTracker.Clear();
        var sent = await db.EmailNotifications.SingleAsync(x => x.Id == queued.Id);
        Check(sent.State == "SENT" && sent.Attempts == 2 && sent.SentAt.HasValue && sent.ProtectedPayload == "", "persist send success and erase payload");
        Check(http.Sends == sends + 1, "SQL lock prevents concurrent duplicate delivery");
        Check(!await worker.ProcessOne(CancellationToken.None), "sent notifications never reprocessed");
        queue.Enqueue(organization, new OrganizationReview { Action = "REJECT", OrganizationId = organization.Id });
        await db.SaveChangesAsync();
        http.EmailStatus = HttpStatusCode.UnprocessableEntity;
        await worker.ProcessOne(CancellationToken.None);
        db.ChangeTracker.Clear();
        Check(await db.EmailNotifications.AnyAsync(x => x.OrganizationId == organization.Id && x.State == "FAILED" && x.LastErrorCode == "EMAILJS_HTTP_422"), "failed state persisted");
        Console.WriteLine("PASS: SQL outbox retry, schedule, concurrent workers, success cleanup, permanent failure.");
    }
    finally
    {
        db.ChangeTracker.Clear();
        await db.Organizations.Where(x => x.Id == organization.Id).ExecuteDeleteAsync();
    }
}
Console.WriteLine("PASS: all four event payloads, template mapping, boolean flags, recipient, timestamps, URLs, provider failure classification.");

static void Check(bool condition, string label) { if (!condition) throw new Exception("FAIL: " + label); }

sealed class FakeClients : IHttpClientFactory
{
    public JsonElement? LastRequest { get; private set; }
    public string? LastIdentityPath { get; private set; }
    public HttpStatusCode EmailStatus { get; set; } = HttpStatusCode.OK;
    public HttpStatusCode IdentityStatus { get; set; } = HttpStatusCode.OK;
    public int Sends;
    public HttpClient CreateClient(string name) => new(new Handler(async request =>
    {
        if (name == "identity-notifications")
        {
            LastIdentityPath = request.RequestUri!.AbsolutePath;
            return new HttpResponseMessage(IdentityStatus) { Content = new StringContent("{\"email\":\"account@example.test\",\"fullName\":\"Account Owner\"}", System.Text.Encoding.UTF8, "application/json") };
        }
        Interlocked.Increment(ref Sends);
        using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync());
        LastRequest = body.RootElement.Clone();
        return new HttpResponseMessage(EmailStatus);
    })) { BaseAddress = new Uri("https://test.invalid/") };

    private sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handle) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => handle(request);
    }
}
