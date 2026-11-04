using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Contracts;
using OrganizationService.Data;

namespace OrganizationService.Services;

public sealed class OrganizationMembers(OrganizationDb db, WorkspaceAccess access, IdentityDirectory directory)
{
    public async Task<object> Members(OrganizationActor actor, Guid id, int page, CancellationToken cancellationToken)
    {
        await access.Require(id, actor);
        var query = db.Members.AsNoTracking().Include(x => x.Roles).Where(x => x.OrganizationId == id);
        var members = await query.OrderByDescending(x => x.Role == "OWNER").ThenBy(x => x.JoinedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20).ToListAsync(cancellationToken);
        var accounts = await directory.Read(members.Select(x => x.UserId), cancellationToken);
        var owner = actor.IsAdmin || await db.Members.AnyAsync(x => x.OrganizationId == id && x.UserId == actor.UserId && x.Role == "OWNER" && x.IsActive, cancellationToken);
        return new { totalCount = await query.CountAsync(cancellationToken), page, pageSize = 20, items = members.Select(x => new
        {
            x.Id, x.UserId, fullName = accounts.GetValueOrDefault(x.UserId)?.FullName ?? "Tài khoản không còn tồn tại",
            email = owner ? accounts.GetValueOrDefault(x.UserId)?.Email : null,
            accountActive = accounts.GetValueOrDefault(x.UserId)?.IsActive ?? false,
            roles = WorkspaceAccess.Roles(x), x.IsActive, x.JoinedAt, version = Convert.ToBase64String(x.Version)
        }) };
    }

    public async Task<object> Roles(OrganizationActor actor, Guid id, Guid memberId, MemberRolesRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "OWNER");
        var member = await EditableMember(id, memberId, actor.UserId);
        WorkspaceAccess.Match(member.Version, request.Version);
        var roles = WorkspaceAccess.ValidateRoles(request.Roles);
        member.Role = roles[0];
        member.Roles.RemoveAll(x => !roles.Contains(x.Role));
        foreach (var role in roles.Except(member.Roles.Select(x => x.Role))) member.Roles.Add(new OrganizationMemberRole { Role = role });
        member.UpdatedAt = DateTimeOffset.UtcNow;
        access.Audit(id, actor.UserId, "MEMBER_ROLES_UPDATED", new { member.UserId, roles });
        await access.Save(cancellationToken);
        return new { version = Convert.ToBase64String(member.Version) };
    }

    public async Task<object> State(OrganizationActor actor, Guid id, Guid memberId, MemberStateRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "OWNER");
        var member = await EditableMember(id, memberId, actor.UserId);
        WorkspaceAccess.Match(member.Version, request.Version);
        member.IsActive = request.IsActive; member.UpdatedAt = DateTimeOffset.UtcNow;
        access.Audit(id, actor.UserId, request.IsActive ? "MEMBER_REACTIVATED" : "MEMBER_SUSPENDED", new { member.UserId });
        await access.Save(cancellationToken);
        return new { version = Convert.ToBase64String(member.Version) };
    }

    public async Task<object> Activity(OrganizationActor actor, Guid id, int page, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, true, "OWNER");
        var query = db.Activities.AsNoTracking().Where(x => x.OrganizationId == id);
        var items = await query.OrderByDescending(x => x.At).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20).ToListAsync();
        var accounts = await directory.Read(items.Select(x => x.ActorUserId), cancellationToken);
        return new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = items.Select(x => new { x.Id, x.ActorUserId, actorName = accounts.GetValueOrDefault(x.ActorUserId)?.FullName ?? "Tài khoản không còn tồn tại", x.Action, x.Detail, x.At }) };
    }

    private async Task<OrganizationMember> EditableMember(Guid id, Guid memberId, Guid actorId)
    {
        var member = await db.Members.Include(x => x.Roles).SingleOrDefaultAsync(x => x.OrganizationId == id && x.Id == memberId)
            ?? throw new Shared.ApiException(404, "Không tìm thấy thành viên.");
        if (member.Role == "OWNER" || member.UserId == actorId) throw new Shared.ApiException(400, "Không được thay đổi hoặc khóa OWNER bằng chức năng nhân sự.");
        return member;
    }
}
