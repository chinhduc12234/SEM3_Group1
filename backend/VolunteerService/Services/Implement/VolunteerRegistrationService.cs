using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Shared;
using VolunteerService.Contracts;
using VolunteerService.Data;
using VolunteerService.Repositories;

namespace VolunteerService.Services;

public sealed class VolunteerRegistrationService(
    IVolunteerRegistrationRepository repository,
    ICampaignOpeningsClient campaignOpenings,
    ICampaignReviewAccessClient reviewAccess) : IVolunteerRegistrationService
{
    private static readonly string[] ReviewStatuses = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "WAITLISTED", "REJECTED", "WITHDRAWN"];

    public async Task<VolunteerRegistrationResult> Submit(Guid userId, SubmitVolunteerRegistrationRequest request,
        CancellationToken ct)
    {
        if (userId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (request.CampaignId == Guid.Empty) throw new ApiException(400, "Chiến dịch không hợp lệ.");
        if (!request.AgreedToTerms) throw new ApiException(400, "Bạn cần đồng ý với điều khoản ứng tuyển.");
        if (!request.CommitsToAllDays) throw new ApiException(400, "Chiến dịch này yêu cầu tình nguyện viên cam kết tham gia toàn bộ ngày triển khai.");
        if (request.GroupIds.Length == 0 || request.GroupIds.Any(id => id == Guid.Empty) ||
            request.GroupIds.Distinct().Count() != request.GroupIds.Length)
            throw new ApiException(400, "Hãy chọn ít nhất một nhóm tình nguyện hợp lệ; không chọn trùng nhóm.");
        if (request.DateOfBirth is DateOnly dateOfBirth && dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
            throw new ApiException(400, "Ngày sinh không hợp lệ.");

        var openings = await campaignOpenings.Get(request.CampaignId, ct)
            ?? throw new ApiException(404, "Chiến dịch chưa mở đăng ký tình nguyện viên.");
        var availableGroupIds = openings.Groups.Select(group => group.Id).ToHashSet();
        if (request.GroupIds.Any(groupId => !availableGroupIds.Contains(groupId)))
            throw new ApiException(400, "Có nhóm không thuộc chiến dịch hoặc không còn mở đăng ký.");
        if (await repository.Exists(userId, request.CampaignId, ct))
            throw new ApiException(409, "Bạn đã gửi hồ sơ tình nguyện cho chiến dịch này.");

        var now = DateTimeOffset.UtcNow;
        var registration = new VolunteerRegistration
        {
            UserId = userId,
            CampaignId = request.CampaignId,
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            PhoneNumber = request.PhoneNumber.Trim(),
            DateOfBirth = request.DateOfBirth,
            Occupation = Normalize(request.Occupation),
            HealthNote = Normalize(request.HealthNote),
            Skills = Normalize(request.Skills),
            Experience = Normalize(request.Experience),
            Motivation = Normalize(request.Motivation),
            EmergencyContactName = Normalize(request.EmergencyContactName),
            EmergencyContactPhone = Normalize(request.EmergencyContactPhone),
            CommitsToAllDays = true,
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

        var notificationEvent = new VolunteerRegistrationNotificationEvent(Guid.NewGuid(), registration.CampaignId,
            registration.Id, registration.FullName, now);
        repository.Add(registration);
        repository.AddNotificationOutbox(new VolunteerNotificationOutbox
        {
            Id = notificationEvent.EventId,
            RegistrationId = registration.Id,
            Payload = JsonSerializer.Serialize(notificationEvent),
            CreatedAt = now,
            NextAttemptAt = now
        });
        try { await repository.Save(ct); }
        catch (DbUpdateException)
        {
            if (await repository.Exists(userId, request.CampaignId, ct))
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
                .Select(x => new VolunteerGroupAssignmentResult(x.GroupId, x.Status, x.AssignedBy, x.AssignedAt)).ToArray());
    }

    public async Task<VolunteerReviewResult> Review(Guid reviewerId, Guid registrationId,
        ReviewVolunteerRegistrationRequest request, CancellationToken ct)
    {
        if (reviewerId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (registrationId == Guid.Empty) throw new ApiException(400, "Mã hồ sơ không hợp lệ.");
        var decision = request.Decision.Trim().ToUpperInvariant();
        if (decision is not ("APPROVE" or "WAITLIST" or "REJECT"))
            throw new ApiException(400, "Quyết định xét duyệt không hợp lệ.");

        var registration = await repository.FindForUpdate(registrationId, ct)
            ?? throw new ApiException(404, "Không tìm thấy hồ sơ tình nguyện.");
        if (!await reviewAccess.CanReview(registration.CampaignId, reviewerId, ct))
            throw new ApiException(403, "Bạn không được phân công xét duyệt tình nguyện viên cho chiến dịch này.");
        if (registration.Status is not ("SUBMITTED" or "UNDER_REVIEW" or "WAITLISTED"))
            throw new ApiException(409, "Hồ sơ này đã có quyết định cuối cùng và không thể xét duyệt lại.");

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
            var openings = await campaignOpenings.Get(registration.CampaignId, ct)
                ?? throw new ApiException(409, "Chiến dịch đã đóng đăng ký; không thể phân nhóm tình nguyện viên.");
            var availableGroups = openings.Groups.ToDictionary(group => group.Id);
            foreach (var groupId in groupIds)
            {
                if (!availableGroups.TryGetValue(groupId, out var group))
                    throw new ApiException(400, "Có nhóm không thuộc chiến dịch hoặc không còn mở đăng ký.");
                var assigned = await repository.CountActiveAssignments(groupId, ct);
                if (assigned >= group.Target)
                    throw new ApiException(409, $"Nhóm {group.Name} đã đủ chỉ tiêu tình nguyện viên.");
            }

            registration.Status = "APPROVED";
            var assignments = groupIds.Select(groupId => new VolunteerGroupAssignment
            {
                RegistrationId = registration.Id,
                CampaignId = registration.CampaignId,
                GroupId = groupId,
                AssignedBy = reviewerId,
                AssignedAt = now,
                Status = "ACTIVE"
            }).ToArray();
            repository.AddAssignments(assignments);
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
        await repository.Save(ct);

        return new VolunteerReviewResult(registration.Id, registration.CampaignId, registration.Status,
            reviewerId, now, registration.ReviewNote, registration.RejectionReason,
            registration.GroupAssignments.Where(group => group.Status == "ACTIVE")
                .OrderBy(group => group.AssignedAt)
                .Select(group => new VolunteerGroupAssignmentResult(group.GroupId, group.Status,
                    group.AssignedBy, group.AssignedAt)).ToArray());
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
        var groups = openings.Groups.Select(group =>
        {
            var assigned = counts.GetValueOrDefault(group.Id);
            return new VolunteerGroupManagementItem(group.Id, group.Name, group.Category, group.Target,
                assigned, Math.Max(0, group.Target - assigned), group.Date, group.ActivityTitle, group.TeamName,
                group.TeamLeaderName);
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
                assignment.AssignedAt, assignment.AssignedBy)).ToArray();
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
