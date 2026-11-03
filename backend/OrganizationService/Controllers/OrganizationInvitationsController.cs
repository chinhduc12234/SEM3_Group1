using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Contracts;
using OrganizationService.Data;
using OrganizationService.Services;
using Shared;

namespace OrganizationService.Controllers;

[ApiController, Authorize, Route("api/organizations"), EnableRateLimiting("organization")]
public sealed class OrganizationInvitationsController(OrganizationDb db, WorkspaceAccess access, IdentityDirectory directory) : ControllerBase
{
    private Guid Actor => WorkspaceAccess.Actor(User);

    [HttpGet("invitations/mine")]
    public async Task<IActionResult> Mine()
    {
        var now = DateTimeOffset.UtcNow;
        return Ok(await db.Invitations.AsNoTracking().Where(x => x.InvitedUserId == Actor && x.State == "PENDING" && x.ExpiresAt > now)
            .OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.OrganizationId,
                organizationName = db.Organizations.Where(o => o.Id == x.OrganizationId).Select(o => o.Profile.LegalName).First(),
                x.RolesJson, x.CreatedAt, x.ExpiresAt, version = Convert.ToBase64String(x.Version) }).ToListAsync());
    }

    [HttpGet("{id:guid}/workspace/invitations")]
    public async Task<IActionResult> List(Guid id, [FromQuery, Range(1, 100000)] int page = 1, CancellationToken cancellationToken = default)
    {
        await access.Require(id, User, true, "OWNER");
        var query = db.Invitations.AsNoTracking().Where(x => x.OrganizationId == id);
        var items = await query.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20).ToListAsync(cancellationToken);
        var accounts = await directory.Read(items.Select(x => x.InvitedUserId), cancellationToken);
        return Ok(new { totalCount = await query.CountAsync(cancellationToken), page, pageSize = 20, items = items.Select(x => new
        {
            x.Id, x.InvitedUserId, fullName = accounts.GetValueOrDefault(x.InvitedUserId)?.FullName,
            email = accounts.GetValueOrDefault(x.InvitedUserId)?.Email, roles = JsonSerializer.Deserialize<string[]>(x.RolesJson),
            state = x.State == "PENDING" && x.ExpiresAt <= DateTimeOffset.UtcNow ? "EXPIRED" : x.State,
            x.CreatedAt, x.ExpiresAt, version = Convert.ToBase64String(x.Version)
        }) });
    }

    [HttpPost("{id:guid}/workspace/invitations")]
    public async Task<IActionResult> Invite(Guid id, InviteMemberRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, User, false, "OWNER");
        var roles = WorkspaceAccess.ValidateRoles(request.Roles);
        var account = await directory.Lookup(request.Email, cancellationToken);
        if (account.IsAdmin || account.Id == Actor) throw new ApiException(400, "Không mời tài khoản admin hệ thống hoặc chính mình làm nhân sự.");
        if (await db.Members.AnyAsync(x => x.OrganizationId == id && x.UserId == account.Id, cancellationToken))
            throw new ApiException(409, "Tài khoản đã là thành viên. Hãy quản lý vai trò hoặc kích hoạt lại từ danh sách nhân sự.");
        // Expire old pending invitations atomically before inserting a replacement.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Invitations.Where(x => x.OrganizationId == id && x.InvitedUserId == account.Id && x.State == "PENDING" && x.ExpiresAt <= DateTimeOffset.UtcNow)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.State, "EXPIRED"), cancellationToken);
        var invitation = new OrganizationInvitation { OrganizationId = id, InvitedUserId = account.Id, InvitedBy = Actor, RolesJson = JsonSerializer.Serialize(roles) };
        db.Invitations.Add(invitation);
        access.Audit(id, Actor, "MEMBER_INVITED", new { invitationId = invitation.Id, userId = account.Id, roles });
        await access.Save(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Created($"/api/organizations/invitations/mine", new { invitation.Id, invitation.ExpiresAt });
    }

    [HttpPost("invitations/{invitationId:guid}/respond")]
    public async Task<IActionResult> Respond(Guid invitationId, InvitationResponseRequest request, CancellationToken cancellationToken)
    {
        var invitation = await db.Invitations.SingleOrDefaultAsync(x => x.Id == invitationId && x.InvitedUserId == Actor, cancellationToken)
            ?? throw new ApiException(404, "Không tìm thấy lời mời dành cho tài khoản này.");
        WorkspaceAccess.Match(invitation.Version, request.Version);
        if (invitation.State != "PENDING" || invitation.ExpiresAt <= DateTimeOffset.UtcNow) throw new ApiException(409, "Lời mời đã hết hạn hoặc đã được xử lý.");
        if (!await db.Organizations.AnyAsync(x => x.Id == invitation.OrganizationId && x.Status == "ACTIVE", cancellationToken)) throw new ApiException(409, "Tổ chức chưa hoạt động.");
        if (User.IsInRole("ADMIN")) throw new ApiException(403, "Admin hệ thống không tham gia tổ chức bằng lời mời nhân sự.");
        invitation.State = request.Accept ? "ACCEPTED" : "DECLINED";
        if (request.Accept)
        {
            var roles = WorkspaceAccess.ValidateRoles(JsonSerializer.Deserialize<string[]>(invitation.RolesJson) ?? []);
            if (await db.Members.AnyAsync(x => x.OrganizationId == invitation.OrganizationId && x.UserId == Actor, cancellationToken)) throw new ApiException(409, "Bạn đã có tư cách thành viên.");
            db.Members.Add(new OrganizationMember { OrganizationId = invitation.OrganizationId, UserId = Actor, Role = roles[0],
                Roles = roles.Select(r => new OrganizationMemberRole { Role = r }).ToList() });
        }
        access.Audit(invitation.OrganizationId, Actor, request.Accept ? "INVITATION_ACCEPTED" : "INVITATION_DECLINED", new { invitation.Id });
        await access.Save(cancellationToken);
        return Ok(new { invitation.State });
    }

    [HttpPost("{id:guid}/workspace/invitations/{invitationId:guid}/revoke")]
    public async Task<IActionResult> Revoke(Guid id, Guid invitationId, VersionRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, User, false, "OWNER");
        var invitation = await db.Invitations.SingleOrDefaultAsync(x => x.Id == invitationId && x.OrganizationId == id, cancellationToken)
            ?? throw new ApiException(404, "Không tìm thấy lời mời.");
        WorkspaceAccess.Match(invitation.Version, request.Version);
        if (invitation.State != "PENDING") throw new ApiException(409, "Lời mời đã được xử lý.");
        invitation.State = "REVOKED";
        access.Audit(id, Actor, "INVITATION_REVOKED", new { invitation.Id });
        await access.Save(cancellationToken);
        return Ok(new { invitation.State });
    }
}
