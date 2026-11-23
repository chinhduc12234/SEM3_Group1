using VolunteerService.Data;

namespace VolunteerService.Repositories;

public interface IVolunteerRegistrationRepository
{
    Task<bool> Exists(Guid userId, Guid campaignId, CancellationToken ct);
    Task<(VolunteerRegistration[] Items, int TotalCount)> ListForCampaign(Guid campaignId, string status,
        int page, int pageSize, CancellationToken ct);
    Task<VolunteerRegistration?> FindForReview(Guid registrationId, CancellationToken ct);
    Task<VolunteerRegistration?> FindForUpdate(Guid registrationId, CancellationToken ct);
    Task<int> CountActiveAssignments(Guid groupId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountActiveAssignments(Guid campaignId, Guid[] groupIds, CancellationToken ct);
    Task<int> CountPending(Guid campaignId, CancellationToken ct);
    Task<VolunteerGroupAssignment[]> GroupMembers(Guid campaignId, Guid groupId, CancellationToken ct);
    void Add(VolunteerRegistration registration);
    void AddNotificationOutbox(VolunteerNotificationOutbox item);
    void AddAssignments(IEnumerable<VolunteerGroupAssignment> assignments);
    Task Save(CancellationToken ct);
}
