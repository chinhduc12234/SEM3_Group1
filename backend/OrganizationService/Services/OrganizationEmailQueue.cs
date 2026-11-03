using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using OrganizationService.Data;

namespace OrganizationService.Services;

public sealed record OrganizationEmailPayload(Guid ApplicantUserId, Dictionary<string, object> Parameters);

public sealed class OrganizationEmailQueue(OrganizationDb db, IDataProtectionProvider protection, IOptions<EmailOptions> options)
{
    private readonly IDataProtector protector = protection.CreateProtector("GiveAid.Organization.EmailOutbox.v1");

    public void Enqueue(Organization organization, OrganizationReview review)
    {
        var p = organization.Profile;
        var approved = review.Action == "APPROVE";
        var changes = review.Action == "REQUEST_CHANGES";
        var rejected = review.Action == "REJECT";
        var root = options.Value.WebsiteUrl.TrimEnd('/');
        var parameters = new Dictionary<string, object>
        {
            ["organization_name"] = p.LegalName,
            ["application_id"] = organization.Id.ToString(),
            ["registration_number"] = p.RegistrationNumber,
            ["representative_name"] = p.RepresentativeName,
            ["submitted_at"] = Format(organization.SubmittedAt ?? review.At),
            ["application_url"] = $"{root}/organizations/{organization.Id}",
            ["management_url"] = $"{root}/organizations/mine",
            ["login_url"] = $"{root}/login",
            ["support_email"] = options.Value.SupportEmail,
            ["review_title"] = approved ? "Tổ chức của bạn đã được phê duyệt" : changes
                ? "Hồ sơ tổ chức cần bổ sung hoặc chỉnh sửa" : rejected ? "Hồ sơ đăng ký tổ chức đã bị từ chối" : "Đã tiếp nhận hồ sơ đăng ký tổ chức",
            ["review_status"] = approved ? "Đã phê duyệt" : changes ? "Cần bổ sung" : rejected ? "Đã từ chối" : "Chờ xét duyệt",
            ["reviewed_at"] = Format(review.At),
            ["approved_at"] = approved ? Format(review.At) : "",
            ["review_reason"] = review.Reason,
            ["is_approved"] = approved,
            ["is_changes_requested"] = changes,
            ["is_rejected"] = rejected
        };
        // Same DbContext/SaveChanges transaction as the review, membership and organization state.
        db.EmailNotifications.Add(new EmailNotification
        {
            OrganizationId = organization.Id, EventId = review.Id, Action = review.Action, CreatedAt = review.At,
            ProtectedPayload = protector.Protect(JsonSerializer.Serialize(new OrganizationEmailPayload(organization.ApplicantUserId, parameters)))
        });
    }

    private static string Format(DateTimeOffset date) =>
        date.ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy HH:mm:ss '(UTC+7)'", CultureInfo.InvariantCulture);
}
