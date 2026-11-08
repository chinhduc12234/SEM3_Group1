namespace NotificationService.Services;

public sealed class FirebaseOptions
{
    public bool Enabled { get; set; }
    public string CredentialPath { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public string AuthDomain { get; set; } = "";
    public string StorageBucket { get; set; } = "";
    public string MessagingSenderId { get; set; } = "";
    public string AppId { get; set; } = "";
    public string VapidPublicKey { get; set; } = "";
    public string WebsiteUrl { get; set; } = "http://localhost:8080";
    public bool IsValid() => Uri.TryCreate(WebsiteUrl, UriKind.Absolute, out var url) &&
        (url.Scheme == "https" || (url.Scheme == "http" && url.IsLoopback)) && url.AbsolutePath == "/" &&
        string.IsNullOrEmpty(url.Query) && string.IsNullOrEmpty(url.Fragment) && string.IsNullOrEmpty(url.UserInfo) &&
        (!Enabled || new[] { CredentialPath, ProjectId, ApiKey, AuthDomain, MessagingSenderId, AppId, VapidPublicKey }.All(x => !string.IsNullOrWhiteSpace(x)));
    public object PublicConfig() => new { enabled = Enabled, vapidPublicKey = VapidPublicKey,
        firebase = new { ApiKey, AuthDomain, ProjectId, StorageBucket, MessagingSenderId, AppId } };
}
