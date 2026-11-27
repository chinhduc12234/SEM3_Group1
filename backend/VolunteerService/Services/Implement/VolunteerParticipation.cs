using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Shared;
using VolunteerService.Contracts;
using VolunteerService.Data;

namespace VolunteerService.Services;

public sealed partial class VolunteerRegistrationService
{
    public async Task<VolunteerAvailability> Availability(Guid campaignId, CancellationToken ct)
    {
        var openings = await campaignOpenings.Get(campaignId, ct)
            ?? throw new ApiException(404, "Chiến dịch chưa mở đăng ký tình nguyện viên.");
        var assigned = await repository.CountActiveAssignments(campaignId, openings.Groups.Select(group => group.Id).ToArray(), ct);
        var confirmed = await repository.CountConfirmedAssignments(campaignId, ct);
        var now = DateTimeOffset.UtcNow;
        return new(campaignId, await repository.CountSubmitted(campaignId, ct), openings.Groups.Select(group =>
            new VolunteerGroupAvailability(group.Id, assigned.GetValueOrDefault(group.Id), confirmed.GetValueOrDefault(group.Id),
                group.Target, Deadline(group, openings, now) > now)).ToArray());
    }

    public async Task<VolunteerRegistrationMine[]> Mine(Guid userId, int page, Guid? campaignId, CancellationToken ct) =>
        (await repository.Mine(userId, page, campaignId, ct)).Select(MineView).ToArray();

    public async Task<VolunteerRegistrationMine> Mine(Guid userId, Guid id, CancellationToken ct)
    {
        var row = await FindMine(userId, id, ct);
        if (row.Status == "WITHDRAWN") throw new ApiException(404, "Hồ sơ này không còn khả dụng.");
        return MineView(row) with { Profile = new VolunteerRegistrationProfile(
            row.FullName, row.Email, row.PhoneNumber, row.DateOfBirth, row.Occupation, row.Skills, row.Experience,
            row.Motivation, row.EmergencyContactName, row.EmergencyContactPhone, Dates(row), row.CommitsToAllDays,
            row.GroupPreferences.OrderBy(group => group.PreferenceRank).Select(group => group.GroupId).ToArray()) };
    }

    public Task<VolunteerParticipationHistory[]> ParticipationHistory(Guid userId, int page, CancellationToken ct) =>
        repository.ParticipationHistory(userId, page, ct);

    public Task<VolunteerRemovalHistory[]> RemovalHistory(Guid userId, int page, Guid? registrationId, CancellationToken ct) =>
        repository.RemovalHistory(userId, page, registrationId, ct);

    public async Task<VolunteerRegistrationMine> Respond(Guid userId, Guid registrationId, Guid offerId, bool accept, CancellationToken ct)
    {
        var located = await FindMine(userId, registrationId, ct);
        var openings = await campaignOpenings.Get(located.CampaignId, ct);
        await using var gate = await repository.LockCampaign(located.CampaignId, ct);
        var row = (await repository.FindForUpdate(registrationId, ct))!;
        var offer = row.GroupAssignments.SingleOrDefault(candidate => candidate.Id == offerId)
            ?? throw new ApiException(404, "Không tìm thấy ca tình nguyện.");
        var now = DateTimeOffset.UtcNow;
        if (accept)
        {
            if (row.Status != "APPROVED" || offer.Status != "ACTIVE") throw new ApiException(409, "Ca này không còn được giữ cho bạn.");
            if (offer.ConfirmedAt.HasValue) return MineView(row);
            if (offer.ConfirmBy <= now) throw new ApiException(410, "Đã hết hạn xác nhận ca.");
            var group = openings?.Groups.SingleOrDefault(candidate => candidate.Id == offer.GroupId);
            if (openings is null || group is null || Deadline(group, openings, now) <= now)
                throw new ApiException(409, "Lịch của ca này đã thay đổi hoặc ca đã bắt đầu.");
            offer.ConfirmedAt = now;
        }
        else
        {
            if (offer.Status == "REMOVED") return MineView(row);
            offer.Status = "REMOVED";
            if (!row.GroupAssignments.Any(candidate => candidate.Status == "ACTIVE")) row.Status = "WITHDRAWN";
        }
        row.UpdatedAt = now;
        await SaveAndPromote(accept ? null : openings, now, ct);
        return MineView(row);
    }

    public async Task<VolunteerRegistrationMine> Withdraw(Guid userId, Guid registrationId, CancellationToken ct)
    {
        var located = await FindMine(userId, registrationId, ct);
        var openings = await campaignOpenings.Get(located.CampaignId, ct);
        await using var gate = await repository.LockCampaign(located.CampaignId, ct);
        var row = (await repository.FindForUpdate(registrationId, ct))!;
        if (row.Status == "WITHDRAWN") return MineView(row);
        if (row.Status == "REJECTED") throw new ApiException(409, "Hồ sơ đã có quyết định từ chối.");
        var now = DateTimeOffset.UtcNow;
        ReleaseRegistration(row, now);
        await SaveAndPromote(openings, now, ct);
        return MineView(row);
    }

    private static void ReleaseRegistration(VolunteerRegistration row, DateTimeOffset now)
    {
        foreach (var offer in row.GroupAssignments.Where(offer => offer.Status == "ACTIVE")) offer.Status = "REMOVED";
        row.Status = "WITHDRAWN";
        row.UpdatedAt = now;
    }

    public async Task RefreshOffers(Guid campaignId, CancellationToken ct)
    {
        var openings = await campaignOpenings.Get(campaignId, ct);
        await using var gate = await repository.LockCampaign(campaignId, ct);
        var now = DateTimeOffset.UtcNow;
        var rows = await repository.ExpiredOffers(campaignId, now, ct);
        foreach (var row in rows)
        {
            foreach (var offer in row.GroupAssignments.Where(offer => offer.Status == "ACTIVE" &&
                offer.ConfirmedAt is null && offer.ConfirmBy <= now)) offer.Status = "REMOVED";
            if (!row.GroupAssignments.Any(offer => offer.Status == "ACTIVE")) row.Status = "WITHDRAWN";
            row.UpdatedAt = now;
            Notify(row, now, "EXPIRED");
        }
        if (rows.Length > 0) await SaveAndPromote(openings, now, ct);
    }

    private async Task SaveAndPromote(CampaignVolunteerOpenings? openings, DateTimeOffset now, CancellationToken ct)
    {
        if (openings is null)
        {
            await repository.Save(ct);
            return;
        }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await repository.Save(ct);
        await Promote(openings, now, ct);
        await transaction.CommitAsync(ct);
    }

    private async Task Promote(CampaignVolunteerOpenings openings, DateTimeOffset now, CancellationToken ct)
    {
        var counts = await repository.CountActiveAssignments(openings.CampaignId, openings.Groups.Select(group => group.Id).ToArray(), ct);
        if (!openings.Groups.Any(group => counts.GetValueOrDefault(group.Id) < group.Target)) return;
        var waiting = await repository.Waitlist(openings.CampaignId, ct);
        foreach (var row in waiting) PlaceAutomatic(row, openings, counts, now);
        if (waiting.Length > 0) await repository.Save(ct);
    }

    private void PlaceAutomatic(VolunteerRegistration row, CampaignVolunteerOpenings openings, Dictionary<Guid, int> counts, DateTimeOffset now)
    {
        var dates = Dates(row) ?? [];
        var compatible = openings.Groups.Where(group => group.Date is DateOnly day && dates.Contains(day) &&
            Deadline(group, openings, now) > now).ToArray();
        var eligible = compatible.Where(group => !group.RequiresReview && group.CategoryId != "SAFETY" &&
            row.DateOfBirth is DateOnly birth && group.Date is DateOnly date && birth.AddYears(18) <= date).ToArray();
        var chosen = eligible.Where(group => counts.GetValueOrDefault(group.Id) < group.Target)
            .OrderByDescending(group => group.IsPriority).ThenBy(group => (decimal)counts.GetValueOrDefault(group.Id) / group.Target)
            .ThenBy(group => row.GroupPreferences.FirstOrDefault(item => item.GroupId == group.Id)?.PreferenceRank ?? short.MaxValue)
            .ThenBy(group => group.Date).ThenBy(group => group.Id).FirstOrDefault();
        if (chosen is not null)
        {
            Offer(row, chosen, openings, now, Guid.Empty);
            row.ReviewedAt = now;
            row.ReviewNote = "Hệ thống xếp ca theo lịch phù hợp và chỉ tiêu còn trống.";
            row.Status = "APPROVED";
            row.UpdatedAt = now;
            counts[chosen.Id] = counts.GetValueOrDefault(chosen.Id) + 1;
            Notify(row, now, "OFFERED");
            return;
        }
        var status = eligible.Length == 0 ? "UNDER_REVIEW" : "WAITLISTED";
        if (status == row.Status) return;
        row.Status = status;
        row.UpdatedAt = now;
        row.ReviewNote = status == "WAITLISTED" ? "Các nhóm phù hợp đã đủ suất." : row.DateOfBirth is null
            ? "Thiếu ngày sinh để tự xét duyệt." : "Ca phù hợp cần kiểm tra tuổi, kỹ năng hoặc lịch tham gia.";
        if (status == "UNDER_REVIEW") Notify(row, now, status, manager: true);
        Notify(row, now, status);
    }

    private void Offer(VolunteerRegistration row, CampaignVolunteerOpeningGroup group, CampaignVolunteerOpenings openings,
        DateTimeOffset now, Guid actor)
    {
        var offer = row.GroupAssignments.SingleOrDefault(assignment => assignment.GroupId == group.Id);
        if (offer is null)
        {
            offer = new VolunteerGroupAssignment { RegistrationId = row.Id, CampaignId = row.CampaignId, GroupId = group.Id };
            row.GroupAssignments.Add(offer);
            repository.AddAssignments([offer]);
        }
        offer.Status = "ACTIVE";
        offer.AssignedBy = actor;
        offer.AssignedAt = now;
        offer.ConfirmBy = Deadline(group, openings, now);
        offer.ConfirmedAt = null;
    }

    private static DateTimeOffset Deadline(CampaignVolunteerOpeningGroup group, CampaignVolunteerOpenings openings, DateTimeOffset now)
    {
        if (group.Date is not DateOnly date) return now;
        var day = openings.Days.FirstOrDefault(item => item.Id == group.DayId);
        var start = day?.Activities.Where(item => group.ActivityId == null || item.Id == group.ActivityId)
            .Select(item => item.Start).Min() ?? TimeOnly.MinValue;
        var timezone = TimeZoneInfo.FindSystemTimeZoneById(openings.Timezone ?? "Asia/Ho_Chi_Minh");
        var local = date.ToDateTime(start);
        var begins = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, timezone), TimeSpan.Zero);
        return begins < now.AddHours(48) ? begins : now.AddHours(48);
    }

    private static bool IsOverlapping(CampaignVolunteerOpeningGroup group, List<CampaignVolunteerOpeningGroup> chosen, CampaignVolunteerOpenings openings)
    {
        var day = openings.Days.FirstOrDefault(item => item.Id == group.DayId);
        var activity = day?.Activities.FirstOrDefault(item => item.Id == group.ActivityId);
        return chosen.Any(other =>
        {
            if (other.Date != group.Date) return false;
            var slot = day?.Activities.FirstOrDefault(item => item.Id == other.ActivityId);
            return activity is null || slot is null || activity.Start is null || activity.End is null ||
                slot.Start is null || slot.End is null || activity.Start < slot.End && slot.Start < activity.End;
        });
    }

    private async Task<VolunteerRegistration> FindMine(Guid userId, Guid id, CancellationToken ct)
    {
        var row = await repository.FindForReview(id, ct);
        return row is not null && row.UserId == userId ? row : throw new ApiException(404, "Không tìm thấy hồ sơ tình nguyện.");
    }

    private static DateOnly[]? Dates(VolunteerRegistration row) => row.AvailableDatesJson is null
        ? null : JsonSerializer.Deserialize<DateOnly[]>(row.AvailableDatesJson);

    private static VolunteerRegistrationMine MineView(VolunteerRegistration row)
    {
        var now = DateTimeOffset.UtcNow;
        return new(row.Id, row.CampaignId, row.Status, row.RejectionReason ?? row.ReviewNote, row.CreatedAt,
            row.GroupAssignments.Select(offer => new VolunteerOfferView(offer.Id, offer.GroupId,
                offer.Status == "REMOVED" ? "RELEASED" : offer.ConfirmedAt.HasValue ? "CONFIRMED" : offer.ConfirmBy <= now ? "EXPIRED" : "OFFERED",
                offer.ConfirmBy, offer.ConfirmedAt)).ToArray());
    }

    private void Notify(VolunteerRegistration row, DateTimeOffset now, string? outcome = null, bool manager = false)
    {
        var item = new VolunteerRegistrationNotificationEvent(Guid.NewGuid(), row.CampaignId, row.Id, row.FullName, now,
            outcome is not null && !manager ? row.UserId : null, outcome);
        repository.AddNotificationOutbox(new VolunteerNotificationOutbox { Id = item.EventId, RegistrationId = row.Id,
            Payload = JsonSerializer.Serialize(item), CreatedAt = now, NextAttemptAt = now });
    }
}
