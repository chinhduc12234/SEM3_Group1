using Microsoft.EntityFrameworkCore;
using VolunteerService.Data;

namespace VolunteerService.Repositories;

public sealed class VolunteerRegistrationRepository(VolunteerDb db) : IVolunteerRegistrationRepository
{
    public Task<bool> Exists(Guid userId, Guid campaignId, CancellationToken ct) =>
        db.Registrations.AnyAsync(x => x.UserId == userId && x.CampaignId == campaignId, ct);

    public async Task<(VolunteerRegistration[] Items, int TotalCount)> ListForCampaign(Guid campaignId, string status,
        int page, int pageSize, CancellationToken ct)
    {
        var query = db.Registrations.AsNoTracking()
            .Where(x => x.CampaignId == campaignId && x.Status == status);
        var count = await query.CountAsync(ct);
        var items = await query.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Include(x => x.GroupPreferences).ToArrayAsync(ct);
        return (items, count);
    }

    public Task<VolunteerRegistration?> FindForReview(Guid registrationId, CancellationToken ct) =>
        db.Registrations.AsNoTracking().Include(x => x.GroupPreferences).Include(x => x.GroupAssignments)
            .SingleOrDefaultAsync(x => x.Id == registrationId, ct);

    public Task<VolunteerRegistration?> FindForUpdate(Guid registrationId, CancellationToken ct) =>
        db.Registrations.Include(x => x.GroupPreferences).Include(x => x.GroupAssignments)
            .SingleOrDefaultAsync(x => x.Id == registrationId, ct);

    public Task<int> CountActiveAssignments(Guid groupId, CancellationToken ct) =>
        db.GroupAssignments.CountAsync(x => x.GroupId == groupId && x.Status == "ACTIVE" &&
            x.Registration.Status == "APPROVED", ct);

    public async Task<Dictionary<Guid, int>> CountActiveAssignments(Guid campaignId, Guid[] groupIds, CancellationToken ct) =>
        await db.GroupAssignments.AsNoTracking().Where(x => x.CampaignId == campaignId &&
                groupIds.Contains(x.GroupId) && x.Status == "ACTIVE" && x.Registration.Status == "APPROVED")
            .GroupBy(x => x.GroupId).Select(group => new { GroupId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count, ct);

    public Task<int> CountPending(Guid campaignId, CancellationToken ct) =>
        db.Registrations.CountAsync(x => x.CampaignId == campaignId &&
            (x.Status == "SUBMITTED" || x.Status == "UNDER_REVIEW"), ct);

    public Task<VolunteerGroupAssignment[]> GroupMembers(Guid campaignId, Guid groupId, CancellationToken ct) =>
        db.GroupAssignments.AsNoTracking().Include(x => x.Registration)
            .Where(x => x.CampaignId == campaignId && x.GroupId == groupId && x.Status == "ACTIVE" &&
                x.Registration.Status == "APPROVED")
            .OrderBy(x => x.AssignedAt).ThenBy(x => x.Id).ToArrayAsync(ct);

    public void Add(VolunteerRegistration registration) => db.Registrations.Add(registration);

    public void AddNotificationOutbox(VolunteerNotificationOutbox item) => db.NotificationOutbox.Add(item);

    public void AddAssignments(IEnumerable<VolunteerGroupAssignment> assignments) =>
        db.GroupAssignments.AddRange(assignments);

    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}
