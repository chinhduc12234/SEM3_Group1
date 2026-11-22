namespace VolunteerService.Services;

public interface ICampaignReviewAccessClient
{
    Task<bool> CanReview(Guid campaignId, Guid userId, CancellationToken ct);
}
