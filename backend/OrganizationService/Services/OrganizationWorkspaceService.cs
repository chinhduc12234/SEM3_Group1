using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Contracts;
using OrganizationService.Data;

namespace OrganizationService.Services;

public sealed class OrganizationWorkspaceService(OrganizationDb db, WorkspaceAccess access, IDataProtectionProvider protection)
{
    private readonly IDataProtector media = protection.CreateProtector("GiveAid.Organization.WorkspaceMedia.v1");

    public async Task<object> Mine(OrganizationActor actor)
    {
        var members = await db.Members.Include(x => x.Roles).Include(x => x.Organization)
            .Where(x => x.UserId == actor.UserId && x.IsActive && x.Organization.Status == "ACTIVE").ToListAsync();
        return members.Select(x => new { id = x.OrganizationId, legalName = x.Organization.Profile.LegalName,
            x.Organization.Status, roles = WorkspaceAccess.Roles(x) });
    }

    public async Task<object> Detail(OrganizationActor actor, Guid id)
    {
        var org = await access.Require(id, actor);
        var member = await db.Members.Include(x => x.Roles).SingleOrDefaultAsync(x => x.OrganizationId == id && x.UserId == actor.UserId && x.IsActive);
        var roles = member is null ? Array.Empty<string>() : WorkspaceAccess.Roles(member);
        var workspace = await db.Workspaces.SingleAsync(x => x.OrganizationId == id);
        var activeMembers = await db.Members.CountAsync(x => x.OrganizationId == id && x.IsActive);
        return new
        {
            id, org.Profile.LegalName, org.Status, org.Profile.OrganizationType, org.Profile.RegistrationNumber,
            org.Profile.RepresentativeName, org.Profile.RepresentativeTitle,
            roles, canEdit = roles.Intersect(new[] { "OWNER", "ORGANIZATION_MANAGER" }).Any(), canManageMembers = roles.Contains("OWNER"),
            profile = Profile(workspace),
            statistics = new { activeMembers, staffCount = await db.Members.CountAsync(x => x.OrganizationId == id && x.IsActive && x.Role != "OWNER"),
                pendingInvitations = await db.Invitations.CountAsync(x => x.OrganizationId == id && x.State == "PENDING" && x.ExpiresAt > DateTimeOffset.UtcNow),
                campaigns = (int?)null, events = (int?)null, donatedAmount = (decimal?)null, fundingSources = (object?)null, featuredCampaigns = (object?)null },
            pendingLegalChange = await db.LegalChanges.Where(x => x.OrganizationId == id && x.State == "PENDING").Select(x => (Guid?)x.Id).FirstOrDefaultAsync()
        };
    }

    public async Task<object> Update(OrganizationActor actor, Guid id, WorkspaceRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "ORGANIZATION_MANAGER");
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
        access.Audit(id, actor.UserId, "PUBLIC_PROFILE_UPDATED", new { fields = "displayName,introduction,mission,focusAreas,contactEmail,contactPhone,website,address" });
        await access.Save(cancellationToken);
        return Profile(profile);
    }

    public async Task<object> Permissions(OrganizationActor actor, Guid id)
    {
        await access.Require(id, actor);
        var member = await db.Members.Include(x => x.Roles).SingleOrDefaultAsync(x => x.OrganizationId == id && x.UserId == actor.UserId && x.IsActive);
        var roles = member is null ? Array.Empty<string>() : WorkspaceAccess.Roles(member);
        var owner = roles.Contains("OWNER");
        return new { organizationId = id, userId = actor.UserId, roles, canView = true,
            canEditProfile = owner || roles.Contains("ORGANIZATION_MANAGER"), canManageMembers = owner,
            canManageCampaigns = owner || roles.Contains("CAMPAIGN_MANAGER"),
            canManageVolunteers = owner || roles.Contains("VOLUNTEER_COORDINATOR"),
            canManageFinance = owner || roles.Contains("FINANCE_MANAGER"),
            canViewFinance = actor.IsAdmin || owner || roles.Contains("FINANCE_MANAGER") };
    }

    public async Task<object> Upload(OrganizationActor actor, Guid id, string kind, OrganizationUpload file, string version, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "ORGANIZATION_MANAGER");
        if (kind is not ("logo" or "cover")) throw new Shared.ApiException(400, "Loại ảnh không hợp lệ.");
        var profile = await db.Workspaces.SingleAsync(x => x.OrganizationId == id);
        WorkspaceAccess.Match(profile.Version, version);
        var upload = await OrganizationFiles.Read(file, true, (kind == "logo" ? 2 : 5) * 1024 * 1024, cancellationToken);
        if (kind == "logo") { profile.ProtectedLogo = media.Protect(upload.Bytes); profile.LogoType = upload.ContentType; }
        else { profile.ProtectedCover = media.Protect(upload.Bytes); profile.CoverType = upload.ContentType; }
        profile.UpdatedAt = DateTimeOffset.UtcNow;
        access.Audit(id, actor.UserId, "ORGANIZATION_IMAGE_UPDATED", new { kind });
        await access.Save(cancellationToken);
        return Profile(profile);
    }

    public async Task<(byte[] Content, string ContentType)?> Image(OrganizationActor actor, Guid id, string kind)
    {
        await access.Require(id, actor);
        var profile = await db.Workspaces.SingleAsync(x => x.OrganizationId == id);
        var bytes = kind == "logo" ? profile.ProtectedLogo : kind == "cover" ? profile.ProtectedCover : null;
        if (bytes is null) return null;
        return (media.Unprotect(bytes), kind == "logo" ? profile.LogoType! : profile.CoverType!);
    }

    private static object Profile(OrganizationWorkspace p) => new
    {
        p.DisplayName, p.Introduction, p.Mission, focusAreas = JsonSerializer.Deserialize<string[]>(p.FocusAreasJson),
        p.ContactEmail, p.ContactPhone, p.Website, p.Address, hasLogo = p.ProtectedLogo is not null, hasCover = p.ProtectedCover is not null,
        p.UpdatedAt, version = Convert.ToBase64String(p.Version)
    };
}
