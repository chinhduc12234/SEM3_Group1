using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Contracts;
using OrganizationService.Data;
using OrganizationService.Services;

namespace OrganizationService.Controllers;

[ApiController, Authorize, Route("api/organizations"), EnableRateLimiting("organization")]
public sealed class OrganizationWorkspaceController(OrganizationDb db, WorkspaceAccess access, IdentityDirectory directory,
    IDataProtectionProvider protection) : ControllerBase
{
    private Guid Actor => WorkspaceAccess.Actor(User);
    private readonly IDataProtector media = protection.CreateProtector("GiveAid.Organization.WorkspaceMedia.v1");

    [HttpGet("workspaces/mine")]
    public async Task<IActionResult> Mine()
    {
        var members = await db.Members.Include(x => x.Roles).Include(x => x.Organization)
            .Where(x => x.UserId == Actor && x.IsActive && x.Organization.Status == "ACTIVE").ToListAsync();
        return Ok(members.Select(x => new { id = x.OrganizationId, legalName = x.Organization.Profile.LegalName,
            x.Organization.Status, roles = WorkspaceAccess.Roles(x) }));
    }

    [HttpGet("{id:guid}/workspace")]
    public async Task<IActionResult> Detail(Guid id)
    {
        var org = await access.Require(id, User);
        var member = await db.Members.Include(x => x.Roles).SingleOrDefaultAsync(x => x.OrganizationId == id && x.UserId == Actor && x.IsActive);
        var roles = member is null ? Array.Empty<string>() : WorkspaceAccess.Roles(member);
        var workspace = await db.Workspaces.SingleAsync(x => x.OrganizationId == id);
        var activeMembers = await db.Members.CountAsync(x => x.OrganizationId == id && x.IsActive);
        return Ok(new
        {
            id, org.Profile.LegalName, org.Status, org.Profile.OrganizationType, org.Profile.RegistrationNumber,
            org.Profile.RepresentativeName, org.Profile.RepresentativeTitle,
            roles, canEdit = roles.Intersect(new[] { "OWNER", "ORGANIZATION_MANAGER" }).Any(), canManageMembers = roles.Contains("OWNER"),
            profile = Profile(workspace),
            statistics = new { activeMembers, staffCount = await db.Members.CountAsync(x => x.OrganizationId == id && x.IsActive && x.Role != "OWNER"),
                pendingInvitations = await db.Invitations.CountAsync(x => x.OrganizationId == id && x.State == "PENDING" && x.ExpiresAt > DateTimeOffset.UtcNow),
                campaigns = (int?)null, events = (int?)null, donatedAmount = (decimal?)null, fundingSources = (object?)null, featuredCampaigns = (object?)null },
            pendingLegalChange = await db.LegalChanges.Where(x => x.OrganizationId == id && x.State == "PENDING").Select(x => (Guid?)x.Id).FirstOrDefaultAsync()
        });
    }

    [HttpPut("{id:guid}/workspace/profile")]
    public async Task<IActionResult> Update(Guid id, WorkspaceRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, User, false, "ORGANIZATION_MANAGER");
        if (request.FocusAreas.Any(x => !WorkspaceAccess.FocusAreas.Contains(x))) throw new Shared.ApiException(400, "Lĩnh vực hoạt động không hợp lệ.");
        if (request.ContactPhone.Count(char.IsAsciiDigit) is < 8 or > 15) throw new Shared.ApiException(400, "Số điện thoại không hợp lệ.");
        if (!string.IsNullOrWhiteSpace(request.Website) && (!Uri.TryCreate(request.Website, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")))
            throw new Shared.ApiException(400, "Website phải bắt đầu bằng http:// hoặc https://.");
        if (request.DisplayName.Trim().Length < 3 || request.Introduction.Trim().Length < 30 || request.Mission.Trim().Length < 30 || request.Address.Trim().Length < 10)
            throw new Shared.ApiException(400, "Thông tin giới thiệu chưa đầy đủ.");
        var profile = await db.Workspaces.SingleAsync(x => x.OrganizationId == id);
        WorkspaceAccess.Match(profile.Version, request.Version);
        profile.DisplayName = request.DisplayName.Trim(); profile.Introduction = request.Introduction.Trim(); profile.Mission = request.Mission.Trim();
        profile.FocusAreasJson = JsonSerializer.Serialize(request.FocusAreas.Distinct().Order());
        profile.ContactEmail = request.ContactEmail.Trim(); profile.ContactPhone = request.ContactPhone.Trim();
        profile.Website = request.Website.Trim(); profile.Address = request.Address.Trim(); profile.UpdatedAt = DateTimeOffset.UtcNow;
        access.Audit(id, Actor, "PUBLIC_PROFILE_UPDATED", new { fields = "displayName,introduction,mission,focusAreas,contactEmail,contactPhone,website,address" });
        await access.Save(cancellationToken);
        return Ok(Profile(profile));
    }

    [HttpGet("{id:guid}/workspace/permissions")]
    public async Task<IActionResult> Permissions(Guid id)
    {
        await access.Require(id, User);
        var member = await db.Members.Include(x => x.Roles).SingleOrDefaultAsync(x => x.OrganizationId == id && x.UserId == Actor && x.IsActive);
        var roles = member is null ? Array.Empty<string>() : WorkspaceAccess.Roles(member);
        var owner = roles.Contains("OWNER");
        return Ok(new { organizationId = id, userId = Actor, roles, canView = true,
            canEditProfile = owner || roles.Contains("ORGANIZATION_MANAGER"), canManageMembers = owner,
            canManageCampaigns = owner || roles.Contains("CAMPAIGN_MANAGER"),
            canManageVolunteers = owner || roles.Contains("VOLUNTEER_COORDINATOR"),
            canManageFinance = owner || roles.Contains("FINANCE_MANAGER"),
            canViewFinance = User.IsInRole("ADMIN") || owner || roles.Contains("FINANCE_MANAGER") });
    }

    [HttpPost("{id:guid}/workspace/media/{kind}"), RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid id, string kind, [Required] IFormFile file, [FromForm, Required] string version, CancellationToken cancellationToken)
    {
        await access.Require(id, User, false, "ORGANIZATION_MANAGER");
        if (kind is not ("logo" or "cover")) throw new Shared.ApiException(400, "Loại ảnh không hợp lệ.");
        var profile = await db.Workspaces.SingleAsync(x => x.OrganizationId == id);
        WorkspaceAccess.Match(profile.Version, version);
        var upload = await OrganizationFiles.Read(file, true, (kind == "logo" ? 2 : 5) * 1024 * 1024, cancellationToken);
        if (kind == "logo") { profile.ProtectedLogo = media.Protect(upload.Bytes); profile.LogoType = upload.ContentType; }
        else { profile.ProtectedCover = media.Protect(upload.Bytes); profile.CoverType = upload.ContentType; }
        profile.UpdatedAt = DateTimeOffset.UtcNow;
        access.Audit(id, Actor, "ORGANIZATION_IMAGE_UPDATED", new { kind });
        await access.Save(cancellationToken);
        return Ok(Profile(profile));
    }

    [HttpGet("{id:guid}/workspace/media/{kind}")]
    public async Task<IActionResult> Image(Guid id, string kind)
    {
        await access.Require(id, User);
        var profile = await db.Workspaces.SingleAsync(x => x.OrganizationId == id);
        var bytes = kind == "logo" ? profile.ProtectedLogo : kind == "cover" ? profile.ProtectedCover : null;
        if (bytes is null) return NotFound();
        return File(media.Unprotect(bytes), kind == "logo" ? profile.LogoType! : profile.CoverType!);
    }

    [HttpGet("{id:guid}/workspace/members")]
    public async Task<IActionResult> Members(Guid id, [FromQuery, Range(1, 100000)] int page = 1, CancellationToken cancellationToken = default)
    {
        await access.Require(id, User);
        var query = db.Members.AsNoTracking().Include(x => x.Roles).Where(x => x.OrganizationId == id);
        var members = await query.OrderByDescending(x => x.Role == "OWNER").ThenBy(x => x.JoinedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20).ToListAsync(cancellationToken);
        var accounts = await directory.Read(members.Select(x => x.UserId), cancellationToken);
        var owner = User.IsInRole("ADMIN") || await db.Members.AnyAsync(x => x.OrganizationId == id && x.UserId == Actor && x.Role == "OWNER" && x.IsActive, cancellationToken);
        return Ok(new { totalCount = await query.CountAsync(cancellationToken), page, pageSize = 20, items = members.Select(x => new
        {
            x.Id, x.UserId, fullName = accounts.GetValueOrDefault(x.UserId)?.FullName ?? "Tài khoản không còn tồn tại",
            email = owner ? accounts.GetValueOrDefault(x.UserId)?.Email : null,
            accountActive = accounts.GetValueOrDefault(x.UserId)?.IsActive ?? false,
            roles = WorkspaceAccess.Roles(x), x.IsActive, x.JoinedAt, version = Convert.ToBase64String(x.Version)
        }) });
    }

    [HttpPut("{id:guid}/workspace/members/{memberId:guid}/roles")]
    public async Task<IActionResult> Roles(Guid id, Guid memberId, MemberRolesRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, User, false, "OWNER");
        var member = await EditableMember(id, memberId);
        WorkspaceAccess.Match(member.Version, request.Version);
        var roles = WorkspaceAccess.ValidateRoles(request.Roles);
        member.Role = roles[0];
        member.Roles.RemoveAll(x => !roles.Contains(x.Role));
        foreach (var role in roles.Except(member.Roles.Select(x => x.Role))) member.Roles.Add(new OrganizationMemberRole { Role = role });
        member.UpdatedAt = DateTimeOffset.UtcNow;
        access.Audit(id, Actor, "MEMBER_ROLES_UPDATED", new { member.UserId, roles });
        await access.Save(cancellationToken);
        return Ok(new { version = Convert.ToBase64String(member.Version) });
    }

    [HttpPut("{id:guid}/workspace/members/{memberId:guid}/state")]
    public async Task<IActionResult> State(Guid id, Guid memberId, MemberStateRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, User, false, "OWNER");
        var member = await EditableMember(id, memberId);
        WorkspaceAccess.Match(member.Version, request.Version);
        member.IsActive = request.IsActive; member.UpdatedAt = DateTimeOffset.UtcNow;
        access.Audit(id, Actor, request.IsActive ? "MEMBER_REACTIVATED" : "MEMBER_SUSPENDED", new { member.UserId });
        await access.Save(cancellationToken);
        return Ok(new { version = Convert.ToBase64String(member.Version) });
    }

    [HttpGet("{id:guid}/workspace/activity")]
    public async Task<IActionResult> Activity(Guid id, [FromQuery, Range(1, 100000)] int page = 1)
    {
        await access.Require(id, User, true, "OWNER");
        var query = db.Activities.AsNoTracking().Where(x => x.OrganizationId == id);
        var items = await query.OrderByDescending(x => x.At).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20).ToListAsync();
        var accounts = await directory.Read(items.Select(x => x.ActorUserId), HttpContext.RequestAborted);
        return Ok(new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = items.Select(x => new { x.Id, x.ActorUserId, actorName = accounts.GetValueOrDefault(x.ActorUserId)?.FullName ?? "Tài khoản không còn tồn tại", x.Action, x.Detail, x.At }) });
    }

    private async Task<OrganizationMember> EditableMember(Guid id, Guid memberId)
    {
        var member = await db.Members.Include(x => x.Roles).SingleOrDefaultAsync(x => x.OrganizationId == id && x.Id == memberId)
            ?? throw new Shared.ApiException(404, "Không tìm thấy thành viên.");
        if (member.Role == "OWNER" || member.UserId == Actor) throw new Shared.ApiException(400, "Không được thay đổi hoặc khóa OWNER bằng chức năng nhân sự.");
        return member;
    }

    private static object Profile(OrganizationWorkspace p) => new
    {
        p.DisplayName, p.Introduction, p.Mission, focusAreas = JsonSerializer.Deserialize<string[]>(p.FocusAreasJson),
        p.ContactEmail, p.ContactPhone, p.Website, p.Address, hasLogo = p.ProtectedLogo is not null, hasCover = p.ProtectedCover is not null,
        p.UpdatedAt, version = Convert.ToBase64String(p.Version)
    };
}
