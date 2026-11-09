using System.Text.Json;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Services;

public sealed class OrganizationNotificationQueue(OrganizationDb db)
{
    public void Enqueue(Organization organization, OrganizationReview review) => db.NotificationEvents.Add(new NotificationEvent
    {
        Id = review.Id, OrganizationId = organization.Id, CreatedAt = review.At,
        Payload = JsonSerializer.Serialize(new OrganizationNotificationEvent(review.Id, organization.Id, organization.ApplicantUserId,
            review.Action, organization.Profile.LegalName, review.At))
    });
}
