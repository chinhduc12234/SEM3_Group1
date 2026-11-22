using VolunteerService.Contracts;

namespace VolunteerService.Services;

public interface IVolunteerRegistrationService
{
    Task<VolunteerRegistrationResult> Submit(Guid userId, SubmitVolunteerRegistrationRequest request, CancellationToken ct);
    Task<VolunteerRegistrationPage> ListForReview(Guid reviewerId, Guid campaignId, string status,
        int page, int pageSize, CancellationToken ct);
    Task<VolunteerRegistrationDetail> GetForReview(Guid reviewerId, Guid registrationId, CancellationToken ct);
    Task<VolunteerReviewResult> Review(Guid reviewerId, Guid registrationId,
        ReviewVolunteerRegistrationRequest request, CancellationToken ct);
}
