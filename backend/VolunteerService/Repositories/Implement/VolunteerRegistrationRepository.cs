using Microsoft.EntityFrameworkCore;
using Shared;
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

    private IQueryable<VolunteerGroupAssignment> Active(DateTimeOffset now) => db.GroupAssignments.AsNoTracking()
        .Where(x => x.Status == "ACTIVE" && x.Registration.Status == "APPROVED" &&
            (x.ConfirmBy == null || x.ConfirmedAt != null || x.ConfirmBy > now));

    public Task<int> CountActiveAssignments(Guid groupId, CancellationToken ct) =>
        Active(DateTimeOffset.UtcNow).CountAsync(x => x.GroupId == groupId, ct);

    public async Task<Dictionary<Guid, int>> CountActiveAssignments(Guid campaignId, Guid[] groupIds, CancellationToken ct) =>
        await Active(DateTimeOffset.UtcNow).Where(x => x.CampaignId == campaignId && groupIds.Contains(x.GroupId))
            .GroupBy(x => x.GroupId).Select(group => new { GroupId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count, ct);

    public Task<Dictionary<Guid, int>> CountConfirmedAssignments(Guid campaignId, CancellationToken ct) =>
        Active(DateTimeOffset.UtcNow).Where(x => x.CampaignId == campaignId && x.ConfirmedAt != null)
            .GroupBy(x => x.GroupId).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.Id, row => row.Count, ct);

    public Task<int> CountSubmitted(Guid campaignId, CancellationToken ct) =>
        db.Registrations.CountAsync(row => row.CampaignId == campaignId, ct);

    public async Task<SqlSessionLock> LockCampaign(Guid campaignId, CancellationToken ct)
    {
        var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Volunteer.Registration.{campaignId:N}");
        try
        {
            if (!await gate.Acquire(ct))
                throw new ApiException(409, "Đang cập nhật suất tình nguyện của chiến dịch. Hãy thử lại.");
            var now = DateTimeOffset.UtcNow;
            if (await db.LaunchRosterHolds.AnyAsync(item => item.CampaignId == campaignId && item.ExpiresAt > now, ct))
                throw new ApiException(409, "Chương trình đang chốt đội hình để bắt đầu. Hãy thử lại sau ít giây.");
            return gate;
        }
        catch
        {
            await gate.DisposeAsync();
            throw;
        }
    }

    public Task<VolunteerRegistration[]> Mine(Guid userId, int page, CancellationToken ct) => db.Registrations.AsNoTracking()
        .Where(row => row.UserId == userId).OrderByDescending(row => row.CreatedAt).ThenByDescending(row => row.Id)
        .Skip((page - 1) * 20).Take(20).Include(row => row.GroupAssignments).ToArrayAsync(ct);

    public Task<VolunteerRegistration[]> ExpiredOffers(Guid campaignId, DateTimeOffset now, CancellationToken ct) =>
        db.Registrations.Where(row => row.CampaignId == campaignId && row.Status == "APPROVED" &&
            row.GroupAssignments.Any(offer => offer.Status == "ACTIVE" && offer.ConfirmedAt == null && offer.ConfirmBy <= now))
        .OrderBy(row => row.Id).Take(200).Include(row => row.GroupAssignments).ToArrayAsync(ct);

    public Task<Guid[]> CampaignsWithQueue(DateTimeOffset now, CancellationToken ct) => db.Registrations.AsNoTracking()
        .Where(row => row.Status == "APPROVED" && row.GroupAssignments.Any(offer => offer.Status == "ACTIVE" &&
            offer.ConfirmedAt == null && offer.ConfirmBy <= now))
        .GroupBy(row => row.CampaignId).OrderBy(group => group.Min(row => row.UpdatedAt))
        .Select(group => group.Key).Take(32).ToArrayAsync(ct);

    public Task<VolunteerRegistration[]> Waitlist(Guid campaignId, CancellationToken ct) =>
        db.Registrations.Where(row => row.CampaignId == campaignId && row.Status == "WAITLISTED" && row.AvailableDatesJson != null)
            .OrderBy(row => row.CreatedAt).ThenBy(row => row.Id).Take(200)
            .Include(row => row.GroupAssignments).Include(row => row.GroupPreferences).AsSplitQuery().ToArrayAsync(ct);

    public Task<int> CountPending(Guid campaignId, CancellationToken ct) =>
        db.Registrations.CountAsync(x => x.CampaignId == campaignId &&
            (x.Status == "SUBMITTED" || x.Status == "UNDER_REVIEW"), ct);

    public Task<VolunteerGroupAssignment[]> GroupMembers(Guid campaignId, Guid groupId, CancellationToken ct) =>
        Active(DateTimeOffset.UtcNow).Include(x => x.Registration)
            .Where(x => x.CampaignId == campaignId && x.GroupId == groupId)
            .OrderBy(x => x.AssignedAt).ThenBy(x => x.Id).ToArrayAsync(ct);

    public void Add(VolunteerRegistration registration) => db.Registrations.Add(registration);

    public void AddNotificationOutbox(VolunteerNotificationOutbox item) => db.NotificationOutbox.Add(item);

    public void AddAssignments(IEnumerable<VolunteerGroupAssignment> assignments) =>
        db.GroupAssignments.AddRange(assignments);

    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}
