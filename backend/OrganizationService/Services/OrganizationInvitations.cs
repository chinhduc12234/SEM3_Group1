using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Contracts;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Services;

public sealed class OrganizationInvitations(OrganizationDb db, WorkspaceAccess access, IdentityDirectory directory)
{

    public async Task<object> Mine(OrganizationActor actor)
    {
        var now = DateTimeOffset.UtcNow;
        return await db.Invitations.AsNoTracking().Where(x => x.InvitedUserId == actor.UserId && x.State == "PENDING" && x.ExpiresAt > now)
            .OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.OrganizationId,
                organizationName = db.Organizations.Where(o => o.Id == x.OrganizationId).Select(o => o.Profile.LegalName).First(),
                x.RolesJson, x.CreatedAt, x.ExpiresAt, version = Convert.ToBase64String(x.Version) }).ToListAsync();
    }

    public async Task<object> List(OrganizationActor actor, Guid id, int page, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, true, "OWNER", "CAMPAIGN_MANAGER");
        var owner = actor.IsAdmin || await db.Members.AnyAsync(x => x.OrganizationId == id && x.UserId == actor.UserId && x.IsActive && x.Role == "OWNER", cancellationToken);
        var query = db.Invitations.AsNoTracking().Where(x => x.OrganizationId == id);
        if (!owner) query = query.Where(x => x.InvitedBy == actor.UserId);
        var items = await query.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20).ToListAsync(cancellationToken);
        var accounts = await directory.Read(items.Select(x => x.InvitedUserId), cancellationToken);
        return new { totalCount = await query.CountAsync(cancellationToken), page, pageSize = 20, items = items.Select(x => new
        {
            x.Id, x.InvitedUserId, fullName = accounts.GetValueOrDefault(x.InvitedUserId)?.FullName,
            email = accounts.GetValueOrDefault(x.InvitedUserId)?.Email, roles = JsonSerializer.Deserialize<string[]>(x.RolesJson),
            state = x.State == "PENDING" && x.ExpiresAt <= DateTimeOffset.UtcNow ? "EXPIRED" : x.State,
            x.CreatedAt, x.ExpiresAt, version = Convert.ToBase64String(x.Version)
        }) };
    }

    public async Task<object> Invite(OrganizationActor actor, Guid id, InviteMemberRequest request, CancellationToken cancellationToken)
    {
        var allowed = await access.RequireInvitationRoles(id, actor.UserId, cancellationToken);
        var roles = WorkspaceAccess.ValidateRoles(request.Roles);
        WorkspaceAccess.EnsureInvitable(roles, allowed);
        var account = await directory.Lookup(request.Email, cancellationToken);
        if (account.IsAdmin || account.Id == actor.UserId) throw new ApiException(400, "Không mời tài khoản admin hệ thống hoặc chính mình làm nhân sự.");
        if (await db.Members.AnyAsync(x => x.OrganizationId == id && x.UserId == account.Id, cancellationToken))
            throw new ApiException(409, "Tài khoản đã là thành viên. Hãy quản lý vai trò hoặc kích hoạt lại từ danh sách nhân sự.");
        // Expire old pending invitations atomically before inserting a replacement.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Invitations.Where(x => x.OrganizationId == id && x.InvitedUserId == account.Id && x.State == "PENDING" && x.ExpiresAt <= DateTimeOffset.UtcNow)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.State, "EXPIRED"), cancellationToken);
        var invitation = new OrganizationInvitation { OrganizationId = id, InvitedUserId = account.Id, InvitedBy = actor.UserId,
            RolesJson = JsonSerializer.Serialize(roles) };
        db.Invitations.Add(invitation);
        access.Audit(id, actor.UserId, "MEMBER_INVITED", new { invitationId = invitation.Id, userId = account.Id, roles });
        await access.Save(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new { invitation.Id, invitation.ExpiresAt };
    }

    public async Task<object> Respond(OrganizationActor actor, Guid invitationId, InvitationResponseRequest request, CancellationToken cancellationToken)
    {
        var invitation = await db.Invitations.SingleOrDefaultAsync(x => x.Id == invitationId && x.InvitedUserId == actor.UserId, cancellationToken)
            ?? throw new ApiException(404, "Không tìm thấy lời mời dành cho tài khoản này.");
        WorkspaceAccess.Match(invitation.Version, request.Version);
        if (invitation.State != "PENDING" || invitation.ExpiresAt <= DateTimeOffset.UtcNow) throw new ApiException(409, "Lời mời đã hết hạn hoặc đã được xử lý.");
        if (!await db.Organizations.AnyAsync(x => x.Id == invitation.OrganizationId && x.Status == "ACTIVE", cancellationToken)) throw new ApiException(409, "Tổ chức chưa hoạt động.");
        if (actor.IsAdmin) throw new ApiException(403, "Admin hệ thống không tham gia tổ chức bằng lời mời nhân sự.");
        invitation.State = request.Accept ? "ACCEPTED" : "DECLINED";
        if (request.Accept)
        {
            var roles = WorkspaceAccess.ValidateRoles(JsonSerializer.Deserialize<string[]>(invitation.RolesJson) ?? []);
            var allowed = await access.RequireInvitationRoles(invitation.OrganizationId, invitation.InvitedBy, cancellationToken);
            WorkspaceAccess.EnsureInvitable(roles, allowed);
            if (await db.Members.AnyAsync(x => x.OrganizationId == invitation.OrganizationId && x.UserId == actor.UserId, cancellationToken)) throw new ApiException(409, "Bạn đã có tư cách thành viên.");
            db.Members.Add(new OrganizationMember { OrganizationId = invitation.OrganizationId, UserId = actor.UserId, Role = roles[0],
                Roles = roles.Select(r => new OrganizationMemberRole { Role = r }).ToList() });
        }
        access.Audit(invitation.OrganizationId, actor.UserId, request.Accept ? "INVITATION_ACCEPTED" : "INVITATION_DECLINED", new { invitation.Id });
        await access.Save(cancellationToken);
        return new { invitation.State };
    }

    public async Task<object> Revoke(OrganizationActor actor, Guid id, Guid invitationId, VersionRequest request, CancellationToken cancellationToken)
    {
        var allowed = await access.RequireInvitationRoles(id, actor.UserId, cancellationToken);
        var invitation = await db.Invitations.SingleOrDefaultAsync(x => x.Id == invitationId && x.OrganizationId == id, cancellationToken)
            ?? throw new ApiException(404, "Không tìm thấy lời mời.");
        if (!allowed.Contains("CAMPAIGN_MANAGER"))
        {
            if (invitation.InvitedBy != actor.UserId) throw new ApiException(403, "Chỉ được thu hồi lời mời do bạn gửi.");
            WorkspaceAccess.EnsureInvitable(JsonSerializer.Deserialize<string[]>(invitation.RolesJson) ?? [], allowed);
        }
        WorkspaceAccess.Match(invitation.Version, request.Version);
        if (invitation.State != "PENDING") throw new ApiException(409, "Lời mời đã được xử lý.");
        invitation.State = "REVOKED";
        access.Audit(id, actor.UserId, "INVITATION_REVOKED", new { invitation.Id });
        await access.Save(cancellationToken);
        return new { invitation.State };
    }

}
