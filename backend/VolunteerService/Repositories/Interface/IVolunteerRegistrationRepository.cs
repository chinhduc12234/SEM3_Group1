using VolunteerService.Data;
using VolunteerService.Contracts;
using Shared;

namespace VolunteerService.Repositories;

public interface IVolunteerRegistrationRepository
{
    Task<bool> ExistsNonWithdrawn(Guid userId, Guid campaignId, CancellationToken ct);
    Task<(VolunteerRegistration[] Items, int TotalCount)> ListForCampaign(Guid campaignId, string status,
        int page, int pageSize, CancellationToken ct);
    Task<VolunteerRegistration?> FindForReview(Guid registrationId, CancellationToken ct);
    Task<VolunteerRegistration?> FindForUpdate(Guid registrationId, CancellationToken ct);
    Task<TaskAssignment[]> OpenTaskAssignments(Guid registrationId, CancellationToken ct);
    Task<int> CountActiveAssignments(Guid groupId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountActiveAssignments(Guid campaignId, Guid[] groupIds, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountConfirmedAssignments(Guid campaignId, CancellationToken ct);
    Task<int> CountSubmitted(Guid campaignId, CancellationToken ct);
    Task<SqlSessionLock> LockCampaign(Guid campaignId, CancellationToken ct);
    Task<VolunteerRegistration[]> Mine(Guid userId, int page, Guid? campaignId, CancellationToken ct);
    Task<VolunteerParticipationHistory[]> ParticipationHistory(Guid userId, int page, CancellationToken ct);
    Task<VolunteerRemovalHistory[]> RemovalHistory(Guid userId, int page, Guid? registrationId, CancellationToken ct);
    Task<VolunteerRegistration[]> ExpiredOffers(Guid campaignId, DateTimeOffset now, CancellationToken ct);
    Task<Guid[]> CampaignsWithQueue(DateTimeOffset now, CancellationToken ct);
    Task<VolunteerRegistration[]> Waitlist(Guid campaignId, CancellationToken ct);
    Task<int> CountPending(Guid campaignId, CancellationToken ct);
    Task<VolunteerGroupAssignment[]> GroupMembers(Guid campaignId, Guid groupId, CancellationToken ct);
    void Add(VolunteerRegistration registration);
    void AddNotificationOutbox(VolunteerNotificationOutbox item);
    void AddAssignments(IEnumerable<VolunteerGroupAssignment> assignments);
    Task Save(CancellationToken ct);
}
