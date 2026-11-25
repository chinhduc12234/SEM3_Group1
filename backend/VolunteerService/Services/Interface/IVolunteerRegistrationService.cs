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
    Task<VolunteerGroupsManagementView> GroupManagement(Guid reviewerId, Guid campaignId, CancellationToken ct);
    Task<VolunteerGroupMember[]> GroupMembers(Guid reviewerId, Guid campaignId, Guid groupId, CancellationToken ct);
    Task<VolunteerAvailability> Availability(Guid campaignId, CancellationToken ct);
    Task<VolunteerRegistrationMine[]> Mine(Guid userId, int page, CancellationToken ct);
    Task<VolunteerRegistrationMine> Mine(Guid userId, Guid id, CancellationToken ct);
    Task<VolunteerRegistrationMine> Respond(Guid userId, Guid registrationId, Guid offerId, bool accept, CancellationToken ct);
    Task<VolunteerRegistrationMine> Withdraw(Guid userId, Guid registrationId, CancellationToken ct);
    Task RefreshOffers(Guid campaignId, CancellationToken ct);
}
