using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Shared;
using VolunteerService.Contracts;
using VolunteerService.Data;
using VolunteerService.Repositories;

namespace VolunteerService.Services;

public sealed partial class VolunteerRegistrationService(
    IVolunteerRegistrationRepository repository,
    ICampaignOpeningsClient campaignOpenings,
    ICampaignReviewAccessClient reviewAccess,
    VolunteerAccountClient accounts, VolunteerDb db) : IVolunteerRegistrationService
{
    private static readonly string[] ReviewStatuses = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "WAITLISTED", "REJECTED", "WITHDRAWN"];

    public async Task<VolunteerRegistrationResult> Submit(Guid userId, SubmitVolunteerRegistrationRequest request,
        CancellationToken ct)
    {
        if (userId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (request.CampaignId == Guid.Empty) throw new ApiException(400, "Chiến dịch không hợp lệ.");
        if (!request.AgreedToTerms) throw new ApiException(400, "Bạn cần đồng ý với điều khoản ứng tuyển.");
        var automatic = request.AvailableDates is not null;
        if (!automatic && !request.CommitsToAllDays) throw new ApiException(400, "Chọn ngày bạn có thể tham gia.");
        if ((!automatic && request.GroupIds.Length == 0) || request.GroupIds.Any(id => id == Guid.Empty) ||
            request.GroupIds.Distinct().Count() != request.GroupIds.Length)
            throw new ApiException(400, "Hãy chọn ít nhất một nhóm tình nguyện hợp lệ; không chọn trùng nhóm.");
        if (request.DateOfBirth is DateOnly dateOfBirth && dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
            throw new ApiException(400, "Ngày sinh không hợp lệ.");

        var openings = await campaignOpenings.Get(request.CampaignId, ct)
            ?? throw new ApiException(404, "Chiến dịch chưa mở đăng ký tình nguyện viên.");
        var availableGroupIds = openings.Groups.Select(group => group.Id).ToHashSet();
        if (request.GroupIds.Any(groupId => !availableGroupIds.Contains(groupId)))
            throw new ApiException(400, "Có nhóm không thuộc chiến dịch hoặc không còn mở đăng ký.");
        var availableDates = request.AvailableDates?.Distinct().Order().ToArray();
        if (availableDates is not null && (availableDates.Length == 0 || availableDates.Any(date =>
            !openings.Days.Any(day => day.Date == date)))) throw new ApiException(400, "Chọn ít nhất một ngày trong lịch triển khai.");
        var account = await accounts.Get(userId, ct);
        await using var gate = await repository.LockCampaign(request.CampaignId, ct);
        if (await repository.ExistsNonWithdrawn(userId, request.CampaignId, ct))
            throw new ApiException(409, "Bạn đã gửi hồ sơ tình nguyện cho chiến dịch này.");

        var now = DateTimeOffset.UtcNow;
        if (automatic && !openings.Groups.Any(group => group.Date is DateOnly date && availableDates!.Contains(date) &&
            Deadline(group, openings, now) > now))
            throw new ApiException(409, "Các ca trong ngày đã chọn đã đóng đăng ký.");
        var registration = new VolunteerRegistration
        {
            UserId = userId,
            CampaignId = request.CampaignId,
            FullName = account.FullName.Trim(),
            Email = account.Email.Trim().ToLowerInvariant(),
            PhoneNumber = request.PhoneNumber.Trim(),
            DateOfBirth = request.DateOfBirth,
            Occupation = Normalize(request.Occupation),
            HealthNote = Normalize(request.HealthNote),
            Skills = Normalize(request.Skills),
            Experience = Normalize(request.Experience),
            Motivation = Normalize(request.Motivation),
            EmergencyContactName = Normalize(request.EmergencyContactName),
            EmergencyContactPhone = Normalize(request.EmergencyContactPhone),
            CommitsToAllDays = automatic ? openings.Days.All(day => day.Date is DateOnly date && availableDates!.Contains(date)) : true,
            AvailableDatesJson = automatic ? JsonSerializer.Serialize(availableDates) : null,
            AgreedToTerms = true,
            TermsAgreedAt = now,
            Status = "SUBMITTED",
            CreatedAt = now,
            UpdatedAt = now,
            GroupPreferences = request.GroupIds.Select((groupId, index) => new RegistrationGroupPreference
            {
                GroupId = groupId,
                PreferenceRank = checked((short)(index + 1)),
                CreatedAt = now
            }).ToList()
        };

        repository.Add(registration);
        if (automatic)
        {
            var counts = await repository.CountActiveAssignments(openings.CampaignId, availableGroupIds.ToArray(), ct);
            PlaceAutomatic(registration, openings, counts, now);
        }
        else Notify(registration, now);
        try { await repository.Save(ct); }
        catch (DbUpdateException)
        {
            if (await repository.ExistsNonWithdrawn(userId, request.CampaignId, ct))
                throw new ApiException(409, "Bạn đã gửi hồ sơ tình nguyện cho chiến dịch này.");
            throw;
        }

        return new VolunteerRegistrationResult(registration.Id, registration.CampaignId, registration.Status,
            registration.CommitsToAllDays, registration.CreatedAt,
            registration.GroupPreferences.OrderBy(x => x.PreferenceRank)
                .Select(x => new VolunteerGroupPreferenceResult(x.GroupId, x.PreferenceRank)).ToArray());
    }

    public async Task<VolunteerRegistrationPage> ListForReview(Guid reviewerId, Guid campaignId, string status,
        int page, int pageSize, CancellationToken ct)
    {
        if (reviewerId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (campaignId == Guid.Empty) throw new ApiException(400, "Chiến dịch không hợp lệ.");
        status = status.Trim().ToUpperInvariant();
        if (!ReviewStatuses.Contains(status, StringComparer.Ordinal))
            throw new ApiException(400, "Trạng thái hồ sơ không hợp lệ.");
        if (!await reviewAccess.CanReview(campaignId, reviewerId, ct))
            throw new ApiException(403, "Bạn không được phân công xét duyệt tình nguyện viên cho chiến dịch này.");

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var (items, totalCount) = await repository.ListForCampaign(campaignId, status, page, pageSize, ct);
        return new VolunteerRegistrationPage(campaignId, status, page, pageSize, totalCount,
            items.Select(registration => new VolunteerRegistrationSummary(registration.Id, registration.CampaignId,
                registration.FullName, registration.Email, registration.PhoneNumber, registration.Status,
                registration.CreatedAt, registration.GroupPreferences.OrderBy(x => x.PreferenceRank)
                    .Select(x => new VolunteerGroupPreferenceResult(x.GroupId, x.PreferenceRank)).ToArray())).ToArray());
    }

    public async Task<VolunteerRegistrationDetail> GetForReview(Guid reviewerId, Guid registrationId, CancellationToken ct)
    {
        if (reviewerId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (registrationId == Guid.Empty) throw new ApiException(400, "Mã hồ sơ không hợp lệ.");
        var registration = await repository.FindForReview(registrationId, ct)
            ?? throw new ApiException(404, "Không tìm thấy hồ sơ tình nguyện.");
        if (!await reviewAccess.CanReview(registration.CampaignId, reviewerId, ct))
            throw new ApiException(403, "Bạn không được phân công xét duyệt tình nguyện viên cho chiến dịch này.");

        return new VolunteerRegistrationDetail(registration.Id, registration.CampaignId,
            registration.FullName, registration.Email, registration.PhoneNumber, registration.DateOfBirth,
            registration.Occupation, registration.HealthNote, registration.Skills, registration.Experience,
            registration.Motivation, registration.EmergencyContactName, registration.EmergencyContactPhone,
            registration.CommitsToAllDays, registration.AgreedToTerms, registration.TermsAgreedAt,
            registration.Status, registration.ReviewedBy, registration.ReviewedAt, registration.RejectionReason,
            registration.CreatedAt,
            registration.GroupPreferences.OrderBy(x => x.PreferenceRank)
                .Select(x => new VolunteerGroupPreferenceResult(x.GroupId, x.PreferenceRank)).ToArray(),
            registration.GroupAssignments.OrderBy(x => x.AssignedAt)
                .Select(x => new VolunteerGroupAssignmentResult(x.GroupId, x.Status, x.AssignedBy, x.AssignedAt, x.ConfirmBy, x.ConfirmedAt)).ToArray(), registration.ReviewNote);
    }

    public async Task<VolunteerReviewResult> Review(Guid reviewerId, Guid registrationId,
        ReviewVolunteerRegistrationRequest request, CancellationToken ct)
    {
        if (reviewerId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (registrationId == Guid.Empty) throw new ApiException(400, "Mã hồ sơ không hợp lệ.");
        var decision = request.Decision.Trim().ToUpperInvariant();
        if (decision is not ("APPROVE" or "WAITLIST" or "REJECT"))
            throw new ApiException(400, "Quyết định xét duyệt không hợp lệ.");

        var located = await repository.FindForReview(registrationId, ct)
            ?? throw new ApiException(404, "Không tìm thấy hồ sơ tình nguyện.");
        if (!await reviewAccess.CanReview(located.CampaignId, reviewerId, ct))
            throw new ApiException(403, "Bạn không được phân công xét duyệt tình nguyện viên cho chiến dịch này.");
        var openings = decision == "APPROVE" ? await campaignOpenings.Get(located.CampaignId, ct) : null;
        await using var gate = await repository.LockCampaign(located.CampaignId, ct);
        var registration = await repository.FindForUpdate(registrationId, ct)
            ?? throw new ApiException(404, "Không tìm thấy hồ sơ tình nguyện.");
        var replacing = registration.Status == "APPROVED" && decision == "APPROVE";
        if (!replacing && registration.Status is not ("SUBMITTED" or "UNDER_REVIEW" or "WAITLISTED"))
            throw new ApiException(409, "Hồ sơ này đã có quyết định cuối cùng và không thể xét duyệt lại.");
        if (replacing && string.IsNullOrWhiteSpace(request.Note))
            throw new ApiException(400, "Hãy ghi lý do khi thay đổi nhóm đã phân công.");

        var groupIds = request.AssignedGroupIds ?? [];
        if (groupIds.Any(id => id == Guid.Empty) || groupIds.Distinct().Count() != groupIds.Length)
            throw new ApiException(400, "Danh sách nhóm được phân công có ID rỗng hoặc trùng.");
        if (decision == "APPROVE" && groupIds.Length == 0)
            throw new ApiException(400, "Khi duyệt hồ sơ, hãy chọn ít nhất một nhóm để phân công.");
        if (decision != "APPROVE" && groupIds.Length > 0)
            throw new ApiException(400, "Chỉ cần chỉ định nhóm khi duyệt hồ sơ.");
        if (decision == "REJECT" && string.IsNullOrWhiteSpace(request.Note))
            throw new ApiException(400, "Hãy ghi lý do từ chối hồ sơ.");

        var now = DateTimeOffset.UtcNow;
        if (decision == "APPROVE")
        {
            if (openings is null) throw new ApiException(409, "Chiến dịch đã đóng đăng ký; không thể phân nhóm tình nguyện viên.");
            var availableGroups = openings.Groups.ToDictionary(group => group.Id);
            var chosen = new List<CampaignVolunteerOpeningGroup>();
            var allowedDates = Dates(registration);
            foreach (var groupId in groupIds)
            {
                if (!availableGroups.TryGetValue(groupId, out var group))
                    throw new ApiException(400, "Có nhóm không thuộc chiến dịch hoặc không còn mở đăng ký.");
                var assigned = await repository.CountActiveAssignments(groupId, ct);
                var alreadyHeld = registration.GroupAssignments.Any(assignment => assignment.GroupId == groupId &&
                    assignment.Status == "ACTIVE" && (assignment.ConfirmedAt.HasValue || assignment.ConfirmBy == null || assignment.ConfirmBy > now));
                if (assigned >= group.Target && !alreadyHeld)
                    throw new ApiException(409, $"Nhóm {group.Name} đã đủ chỉ tiêu tình nguyện viên.");
                if (group.Date is not DateOnly day || allowedDates is not null && !allowedDates.Contains(day) ||
                    IsOverlapping(group, chosen, openings) || Deadline(group, openings, now) <= now)
                    throw new ApiException(409, "Ca không phù hợp với lịch của người đăng ký hoặc bị trùng giờ.");
                chosen.Add(group);
            }

            registration.Status = "APPROVED";
            foreach (var previous in registration.GroupAssignments.Where(assignment => assignment.Status == "ACTIVE" && !groupIds.Contains(assignment.GroupId)))
                previous.Status = "REMOVED";
            foreach (var group in chosen)
            {
                if (registration.GroupAssignments.Any(assignment => assignment.GroupId == group.Id && assignment.Status == "ACTIVE" &&
                    (assignment.ConfirmedAt.HasValue || assignment.ConfirmBy == null || assignment.ConfirmBy > now))) continue;
                Offer(registration, group, openings, now, reviewerId);
            }
        }
        else
        {
            registration.Status = decision == "WAITLIST" ? "WAITLISTED" : "REJECTED";
        }

        registration.ReviewedBy = reviewerId;
        registration.ReviewedAt = now;
        registration.ReviewNote = Normalize(request.Note);
        registration.RejectionReason = decision == "REJECT" ? Normalize(request.Note) : null;
        registration.UpdatedAt = now;
        Notify(registration, now, decision == "APPROVE" ? "OFFERED" : registration.Status);
        await SaveAndPromote(replacing ? openings : null, now, ct);

        return new VolunteerReviewResult(registration.Id, registration.CampaignId, registration.Status,
            reviewerId, now, registration.ReviewNote, registration.RejectionReason,
            registration.GroupAssignments.Where(group => group.Status == "ACTIVE")
                .OrderBy(group => group.AssignedAt)
                .Select(group => new VolunteerGroupAssignmentResult(group.GroupId, group.Status,
                    group.AssignedBy, group.AssignedAt, group.ConfirmBy, group.ConfirmedAt)).ToArray());
    }

    public async Task Remove(Guid reviewerId, Guid registrationId, CancellationToken ct)
    {
        if (reviewerId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (registrationId == Guid.Empty) throw new ApiException(400, "Mã hồ sơ không hợp lệ.");
        var located = await repository.FindForReview(registrationId, ct)
            ?? throw new ApiException(404, "Không tìm thấy hồ sơ tình nguyện.");
        if (!await reviewAccess.CanReview(located.CampaignId, reviewerId, ct))
            throw new ApiException(403, "Bạn không được quản lý tình nguyện viên của chiến dịch này.");
        if (located.Status == "WITHDRAWN") return;

        await using var gate = await repository.LockCampaign(located.CampaignId, ct);
        var registration = await repository.FindForUpdate(registrationId, ct)
            ?? throw new ApiException(404, "Không tìm thấy hồ sơ tình nguyện.");
        if (registration.Status == "WITHDRAWN") return;
        var freesSpots = registration.Status == "APPROVED" && registration.GroupAssignments.Any(offer => offer.Status == "ACTIVE");
        var openings = freesSpots ? await campaignOpenings.Get(registration.CampaignId, ct) : null;
        var now = DateTimeOffset.UtcNow;
        foreach (var assignment in await repository.OpenTaskAssignments(registrationId, ct))
        {
            assignment.Status = "CANCELLED";
            assignment.UpdatedAt = now;
        }
        ReleaseRegistration(registration, now);
        registration.RemovedByCoordinatorAt = now;
        registration.ReviewedBy = reviewerId;
        registration.ReviewedAt = now;
        registration.ReviewNote = "Điều phối viên đã xóa hồ sơ tình nguyện khỏi chiến dịch.";
        Notify(registration, now, "REMOVED");
        await SaveAndPromote(openings, now, ct);
    }

    public async Task<VolunteerGroupsManagementView> GroupManagement(Guid reviewerId, Guid campaignId, CancellationToken ct)
    {
        if (reviewerId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (campaignId == Guid.Empty) throw new ApiException(400, "Chiến dịch không hợp lệ.");
        if (!await reviewAccess.CanReview(campaignId, reviewerId, ct))
            throw new ApiException(403, "Bạn không được quản lý tình nguyện viên của chiến dịch này.");

        var openings = await campaignOpenings.Get(campaignId, ct)
            ?? throw new ApiException(404, "Chiến dịch chưa mở đăng ký tình nguyện viên.");
        var groupIds = openings.Groups.Select(group => group.Id).ToArray();
        var counts = await repository.CountActiveAssignments(campaignId, groupIds, ct);
        var confirmed = await repository.CountConfirmedAssignments(campaignId, ct);
        var groups = openings.Groups.Select(group =>
        {
            var assigned = counts.GetValueOrDefault(group.Id);
            return new VolunteerGroupManagementItem(group.Id, group.Name, group.Category, group.Target,
                assigned, Math.Max(0, group.Target - assigned), group.Date, group.ActivityTitle, group.TeamName,
                group.TeamLeaderName, confirmed.GetValueOrDefault(group.Id));
        }).ToArray();
        var pending = await repository.CountPending(campaignId, ct);
        return new VolunteerGroupsManagementView(campaignId, openings.CampaignTitle, pending,
            groups.Sum(group => group.AssignedCount), groups);
    }

    public async Task<VolunteerGroupMember[]> GroupMembers(Guid reviewerId, Guid campaignId, Guid groupId, CancellationToken ct)
    {
        if (reviewerId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (campaignId == Guid.Empty || groupId == Guid.Empty) throw new ApiException(400, "Chiến dịch hoặc nhóm không hợp lệ.");
        if (!await reviewAccess.CanReview(campaignId, reviewerId, ct))
            throw new ApiException(403, "Bạn không được quản lý tình nguyện viên của chiến dịch này.");

        var openings = await campaignOpenings.Get(campaignId, ct)
            ?? throw new ApiException(404, "Chiến dịch chưa mở đăng ký tình nguyện viên.");
        if (!openings.Groups.Any(group => group.Id == groupId))
            throw new ApiException(404, "Không tìm thấy nhóm tình nguyện trong chiến dịch.");
        return (await repository.GroupMembers(campaignId, groupId, ct)).Select(assignment =>
            new VolunteerGroupMember(assignment.RegistrationId, assignment.Registration.FullName,
                assignment.Registration.Email, assignment.Registration.PhoneNumber,
                assignment.AssignedAt, assignment.AssignedBy, assignment.ConfirmBy, assignment.ConfirmedAt)).ToArray();
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
