using System.Net.Mail;

namespace OrganizationService.Services;

public sealed class EmailOptions
{
    public bool Enabled { get; set; }
    public string ServiceId { get; set; } = "";
    public string PublicKey { get; set; } = "";
    public string PrivateKey { get; set; } = "";
    public string SubmittedTemplateId { get; set; } = "";
    public string ReviewTemplateId { get; set; } = "";
    public string SupportEmail { get; set; } = "";
    public string WebsiteUrl { get; set; } = "";

    public bool IsValid() => !Enabled ||
        new[] { ServiceId, PublicKey, PrivateKey, SubmittedTemplateId, ReviewTemplateId }.All(x => !string.IsNullOrWhiteSpace(x)) &&
        MailAddress.TryCreate(SupportEmail, out _) && Uri.TryCreate(WebsiteUrl, UriKind.Absolute, out var uri) &&
        string.IsNullOrEmpty(uri.UserInfo) && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment) &&
        (uri.Scheme == "https" || uri.Scheme == "http" && uri.IsLoopback);
}
