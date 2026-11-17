using System.Text.Json;
using CampaignService.Contracts;
using CampaignService.Data;
using Shared;

namespace CampaignService.Services;

public sealed partial class CampaignApplication
{
    private static readonly string[] AssignmentRoles = ["CAMPAIGN_MANAGER", "VOLUNTEER_COORDINATOR", "FINANCE_MANAGER"];

    private static bool HasAssignment(Campaign campaign, Guid userId, OrganizationPermission permission, string? role = null) =>
        campaign.Assignments.Any(a => a.UserId == userId && a.MembershipId == permission.MembershipId && a.RevokedAt is null &&
            (role is null || a.Role == role) && permission.Roles.Contains(a.Role));

    public async Task<CampaignMember[]> AssignmentCandidates(Guid id, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        await access.Require(campaign.OrganizationId, actor, ["OWNER"], ct);
        EnsureAssignable(campaign);
        return (await access.Members(campaign.OrganizationId, ct))
            .Where(m => m.Roles.Any(AssignmentRoles.Contains)).ToArray();
    }

    public async Task<CampaignView> Assign(Guid id, CampaignAssignmentRequest request, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        await access.Require(campaign.OrganizationId, actor, ["OWNER"], ct);
        Match(campaign, request.Version);
        EnsureAssignable(campaign);
        var proposed = request.Assignments;
        if (proposed.Any(a => a is null || !AssignmentRoles.Contains(a.Role)) ||
            proposed.Select(a => (a.UserId, a.Role)).Distinct().Count() != proposed.Length ||
            AssignmentRoles.Any(role => proposed.Count(a => a.Role == role && a.IsPrimary) != 1))
            throw new ApiException(400, "Phải chọn đúng một người phụ trách chính cho mỗi vai trò. Không được phân công trùng vai trò cho cùng một người.");

        var members = (await access.Members(campaign.OrganizationId, ct)).ToDictionary(m => m.UserId);
        if (proposed.Any(a => !members.TryGetValue(a.UserId, out var member) || !member.Roles.Contains(a.Role)))
            throw new ApiException(400, "Người được phân công phải có tài khoản, là thành viên đang hoạt động và có đúng vai trò trong tổ chức.");

        var now = DateTimeOffset.UtcNow;
        var active = campaign.Assignments.Where(a => a.RevokedAt is null).ToArray();
        bool Same(CampaignAssignment a, CampaignAssignmentInput p) => a.UserId == p.UserId &&
            a.Role == p.Role && a.IsPrimary == p.IsPrimary && a.MembershipId == members[p.UserId].MembershipId;
        var added = proposed.Where(p => !active.Any(a => Same(a, p))).ToArray();
        var removed = active.Where(a => !proposed.Any(p => Same(a, p))).ToArray();
        if (added.Length == 0 && removed.Length == 0) return View(campaign);
        foreach (var former in removed) former.RevokedAt = now;
        foreach (var item in added)
        {
            var member = members[item.UserId];
            campaign.Assignments.Add(new CampaignAssignment
            {
                CampaignId = id, UserId = member.UserId, MembershipId = member.MembershipId,
                FullName = member.FullName[..Math.Min(member.FullName.Length, 200)], Role = item.Role,
                IsPrimary = item.IsPrimary, AssignedBy = actor, AssignedAt = now
            });
        }
        foreach (var recipient in added.GroupBy(a => a.UserId))
        {
            var eventId = Guid.NewGuid();
            var payload = new CampaignAssignmentEvent(eventId, campaign.OrganizationId, id, recipient.Key,
                campaign.Title, recipient.Select(x => x.Role).ToArray());
            db.AssignmentNotifications.Add(new CampaignNotification
            {
                Id = eventId, NextAttemptAt = now, Payload = JsonSerializer.Serialize(payload, SnapshotJson)
            });
        }
        campaign.Status = "PLANNING";
        campaign.UpdatedAt = now;
        Audit(campaign, actor, "ASSIGN_TEAM", snapshot: JsonSerializer.Serialize(proposed, SnapshotJson));
        await repository.Save(ct);
        return View(campaign);
    }

    private static void EnsureAssignable(Campaign campaign)
    {
        if (campaign.Status is not ("CONCEPT_APPROVED" or "PLANNING"))
            throw new ApiException(409, "Chỉ phân công khi chủ trương đã được chấp thuận.");
    }
}
