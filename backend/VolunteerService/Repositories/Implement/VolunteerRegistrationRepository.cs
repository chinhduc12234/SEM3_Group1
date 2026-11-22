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
        db.GroupAssignments.CountAsync(x => x.GroupId == groupId && x.Status == "ACTIVE", ct);

    public void Add(VolunteerRegistration registration) => db.Registrations.Add(registration);

    public void AddAssignments(IEnumerable<VolunteerGroupAssignment> assignments) =>
        db.GroupAssignments.AddRange(assignments);

    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}
