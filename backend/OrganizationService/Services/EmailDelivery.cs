using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using OrganizationService.Data;

namespace OrganizationService.Services;

public sealed class EmailDeliveryException(string code, bool permanent = false) : Exception(code)
{
    public string Code { get; } = code;
    public bool Permanent { get; } = permanent;
}

public sealed class EmailDelivery(IHttpClientFactory clients, IDataProtectionProvider protection, IOptions<EmailOptions> options)
{
    private sealed record Recipient(string Email, string FullName);
    private readonly IDataProtector protector = protection.CreateProtector("GiveAid.Organization.EmailOutbox.v1");

    public async Task Send(EmailNotification notification, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Deserialize<OrganizationEmailPayload>(protector.Unprotect(notification.ProtectedPayload))
            ?? throw new EmailDeliveryException("INVALID_PAYLOAD", true);
        using var identityResponse = await clients.CreateClient("identity-notifications")
            .GetAsync($"internal/accounts/{payload.ApplicantUserId}/notification-recipient", cancellationToken);
        if (!identityResponse.IsSuccessStatusCode)
            throw new EmailDeliveryException($"IDENTITY_HTTP_{(int)identityResponse.StatusCode}", identityResponse.StatusCode == HttpStatusCode.NotFound);
        var recipient = await identityResponse.Content.ReadFromJsonAsync<Recipient>(cancellationToken)
            ?? throw new EmailDeliveryException("INVALID_RECIPIENT", true);
        if (!System.Net.Mail.MailAddress.TryCreate(recipient.Email, out _)) throw new EmailDeliveryException("INVALID_RECIPIENT", true);

        // Recipient is resolved by Identity, never from an untrusted form/contact email or the reviewing admin.
        payload.Parameters["to_email"] = recipient.Email;
        payload.Parameters["to_name"] = recipient.FullName;
        var config = options.Value;
        // Use current deployment links/config, while preserving the event's organization/review snapshot.
        var root = config.WebsiteUrl.TrimEnd('/');
        payload.Parameters["support_email"] = config.SupportEmail;
        payload.Parameters["application_url"] = $"{root}/organizations/{notification.OrganizationId}";
        payload.Parameters["management_url"] = $"{root}/organizations/mine";
        payload.Parameters["login_url"] = $"{root}/login";
        using var response = await clients.CreateClient("emailjs").PostAsJsonAsync("api/v1.0/email/send", new
        {
            service_id = config.ServiceId,
            template_id = notification.Action == "SUBMITTED" ? config.SubmittedTemplateId : config.ReviewTemplateId,
            user_id = config.PublicKey,
            accessToken = config.PrivateKey,
            template_params = payload.Parameters
        }, cancellationToken);
        // Provider responses can contain personal data: retain status only, never log request/response bodies.
        if (!response.IsSuccessStatusCode)
            throw new EmailDeliveryException($"EMAILJS_HTTP_{(int)response.StatusCode}",
                response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.UnprocessableEntity);
    }
}
