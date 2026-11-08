using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Options;

namespace NotificationService.Services;

public interface IPushSender
{
    Task Send(string token, Guid notificationId, CancellationToken ct);
}

public sealed class FirebasePushSender : IPushSender, IDisposable
{
    private readonly FirebaseApp app;
    public FirebasePushSender(IOptions<FirebaseOptions> options)
    {
        var config = options.Value;
        // Validate the downloaded credential belongs to the same project as the Web app.
        var credential = CredentialFactory.FromFile<ServiceAccountCredential>(config.CredentialPath);
        if (credential.ProjectId != config.ProjectId) throw new InvalidOperationException("Firebase credential project does not match Firebase:ProjectId.");
        app = FirebaseApp.Create(new AppOptions { Credential = GoogleCredential.FromServiceAccountCredential(credential), ProjectId = config.ProjectId });
    }
    public Task Send(string token, Guid notificationId, CancellationToken ct) => FirebaseMessaging.GetMessaging(app).SendAsync(new Message
    {
        // Interoperate with the Web SDK's existing registration-token API during FID migration.
#pragma warning disable CS0618
        Token = token,
#pragma warning restore CS0618
        // Browser notifications may be visible on shared computers. Details require authenticated GET.
        Notification = new FirebaseAdmin.Messaging.Notification { Title = "Give-AID", Body = "Bạn có cập nhật hồ sơ tổ chức. Đăng nhập để xem chi tiết." },
        Data = new Dictionary<string, string> { ["notificationId"] = notificationId.ToString() },
        Webpush = new WebpushConfig { Headers = new Dictionary<string, string> { ["TTL"] = "3600", ["Urgency"] = "normal" },
            Notification = new WebpushNotification { Tag = "giveaid-" + notificationId } }
    }, ct);
    public void Dispose() => app.Delete();
}
