using Microsoft.EntityFrameworkCore;
using OrganizationService.Contracts;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Services;

public sealed class OrganizationMembers(OrganizationDb db, WorkspaceAccess access, IdentityDirectory directory, PersonnelProfiles profiles)
{
    public async Task<object> Members(OrganizationActor actor, Guid id, int page, int pageSize, string? search, string? role,
        string? status, CancellationToken cancellationToken)
    {
        await access.Require(id, actor);
        var owner = !actor.IsAdmin && await db.Members.AnyAsync(x => x.OrganizationId == id && x.UserId == actor.UserId && x.Role == "OWNER" && x.IsActive, cancellationToken);
        var canReadEmail = owner || actor.IsAdmin;
        var query = db.Members.AsNoTracking().Where(x => x.OrganizationId == id);
        if (!canReadEmail) query = query.Where(x => x.UserId != null);
        if (role is not null)
            query = role == "OWNER" ? query.Where(x => x.Role == "OWNER") : query.Where(x => x.Roles.Any(r => r.Role == role));
        query = status switch
        {
            "UNLINKED" => query.Where(x => x.UserId == null),
            "ACTIVE" => query.Where(x => x.UserId != null && x.IsActive),
            "SUSPENDED" => query.Where(x => x.UserId != null && !x.IsActive),
            _ => query
        };
        var ordered = query.OrderByDescending(x => x.Role == "OWNER").ThenByDescending(x => x.JoinedAt).ThenBy(x => x.Id);
        var offset = (page - 1) * pageSize;
        var term = search?.Trim();
        int totalCount;
        IQueryable<OrganizationMember> pageQuery;
        Dictionary<Guid, DirectoryAccount>? accounts = null;
        if (string.IsNullOrEmpty(term))
        {
            totalCount = await query.CountAsync(cancellationToken);
            pageQuery = ordered.Skip(offset).Take(pageSize);
        }
        else
        {
            var candidates = await ordered.Select(x => new { x.Id, x.UserId, x.PersonnelName, x.PersonnelPhone }).ToListAsync(cancellationToken);
            accounts = await directory.Read(candidates.Select(x => x.UserId).OfType<Guid>(), cancellationToken);
            var matches = candidates.Where(x =>
            {
                var account = FindAccount(accounts, x.UserId);
                return Contains(x.PersonnelName ?? account?.FullName, term) ||
                    (canReadEmail && Contains(account?.Email, term)) ||
                    (owner && PhoneContains(x.PersonnelPhone, term));
            }).Select(x => x.Id).ToArray();
            totalCount = matches.Length;
            var ids = matches.Skip(offset).Take(pageSize).ToArray();
            pageQuery = ordered.Where(x => ids.Contains(x.Id));
        }
        var members = await pageQuery.Include(x => x.Roles).ToListAsync(cancellationToken);
        accounts ??= await directory.Read(members.Select(x => x.UserId).OfType<Guid>(), cancellationToken);
        return new { totalCount, page, pageSize, items = members.Select(x =>
        {
            var account = FindAccount(accounts, x.UserId);
            return new
            {
                x.Id, x.UserId, fullName = x.PersonnelName ?? account?.FullName ?? "Tài khoản không còn tồn tại",
                email = canReadEmail ? account?.Email : null,
                phone = owner ? x.PersonnelPhone : null,
                photo = owner ? profiles.ReadPhoto(id, x.ProtectedPersonnelPhoto) : null,
                accountActive = account?.IsActive ?? false,
                roles = WorkspaceAccess.Roles(x), x.IsActive, x.JoinedAt, version = Convert.ToBase64String(x.Version)
            };
        }) };
    }

    private static DirectoryAccount? FindAccount(Dictionary<Guid, DirectoryAccount> accounts, Guid? userId) =>
        userId is Guid id ? accounts.GetValueOrDefault(id) : null;

    private static bool Contains(string? value, string term) =>
        value?.Contains(term, StringComparison.OrdinalIgnoreCase) == true;

    private static bool PhoneContains(string? phone, string term)
    {
        if (phone is null || term.Any(c => !char.IsAsciiDigit(c) && !"+ ()-".Contains(c))) return false;
        var digits = string.Concat(term.Where(char.IsAsciiDigit));
        return digits.Length > 0 && string.Concat(phone.Where(char.IsAsciiDigit)).Contains(digits, StringComparison.Ordinal);
    }

    public async Task<object> Profile(OrganizationActor actor, Guid id, Guid memberId, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "OWNER");
        var member = await FindMember(id, memberId, cancellationToken);
        var account = member.UserId is Guid userId
            ? (await directory.Read([userId], cancellationToken)).GetValueOrDefault(userId)
            : null;
        return new
        {
            fullName = member.PersonnelName ?? account?.FullName ?? "",
            member.UserId,
            email = account?.Email,
            accountActive = account?.IsActive ?? false,
            member.IsActive,
            member.JoinedAt,
            phone = member.PersonnelPhone,
            identityNumber = profiles.ReadIdentity(id, member.ProtectedPersonnelIdentity),
            photo = profiles.ReadPhoto(id, member.ProtectedPersonnelPhoto),
            roles = WorkspaceAccess.Roles(member),
            version = Convert.ToBase64String(member.Version)
        };
    }

    public async Task<Guid> Create(OrganizationActor actor, Guid id, CreateMemberRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "OWNER");
        var roles = WorkspaceAccess.ValidateRoles(request.Roles);
        var profile = await profiles.Protect(id, request.Profile, cancellationToken);
        var member = new OrganizationMember { OrganizationId = id, IsActive = false };
        (member.PersonnelName, member.PersonnelPhone, member.ProtectedPersonnelIdentity, member.ProtectedPersonnelPhoto) = profile;
        ApplyRoles(member, roles);
        db.Members.Add(member);
        access.Audit(id, actor.UserId, "MEMBER_CREATED", new { memberId = member.Id, roles });
        await access.Save(cancellationToken);
        return member.Id;
    }

    public async Task Delete(OrganizationActor actor, Guid id, Guid memberId, string version, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "OWNER");
        var member = await EditableMember(id, memberId, actor.UserId, cancellationToken);
        WorkspaceAccess.Match(member.Version, version);
        await RevokePendingInvitations(member, cancellationToken);
        db.Members.Remove(member);
        access.Audit(id, actor.UserId, "MEMBER_DELETED", new { memberId, member.UserId });
        await access.Save(cancellationToken);
    }

    public async Task<object> UpdateProfile(OrganizationActor actor, Guid id, Guid memberId, MemberProfileRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "OWNER");
        var member = await EditableMember(id, memberId, actor.UserId, cancellationToken);
        WorkspaceAccess.Match(member.Version, request.Version);
        var roles = WorkspaceAccess.ValidateRoles(request.Roles);
        var profile = await profiles.Protect(id, request.Profile, cancellationToken);
        (member.PersonnelName, member.PersonnelPhone, member.ProtectedPersonnelIdentity, member.ProtectedPersonnelPhoto) = profile;
        if (!roles.SequenceEqual(WorkspaceAccess.Roles(member))) await RevokePendingInvitations(member, cancellationToken);
        ApplyRoles(member, roles);
        access.Audit(id, actor.UserId, "MEMBER_PROFILE_UPDATED", new { memberId, member.UserId, roles });
        await access.Save(cancellationToken);
        return new { version = Convert.ToBase64String(member.Version) };
    }

    public async Task<object> Roles(OrganizationActor actor, Guid id, Guid memberId, MemberRolesRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "OWNER");
        var member = await EditableMember(id, memberId, actor.UserId, cancellationToken);
        WorkspaceAccess.Match(member.Version, request.Version);
        var roles = WorkspaceAccess.ValidateRoles(request.Roles);
        if (!roles.SequenceEqual(WorkspaceAccess.Roles(member))) await RevokePendingInvitations(member, cancellationToken);
        ApplyRoles(member, roles);
        access.Audit(id, actor.UserId, "MEMBER_ROLES_UPDATED", new { member.UserId, roles });
        await access.Save(cancellationToken);
        return new { version = Convert.ToBase64String(member.Version) };
    }

    private static void ApplyRoles(OrganizationMember member, string[] roles)
    {
        member.Role = roles[0];
        member.Roles.RemoveAll(x => !roles.Contains(x.Role));
        foreach (var role in roles.Except(member.Roles.Select(x => x.Role))) member.Roles.Add(new OrganizationMemberRole { Role = role });
        member.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private async Task RevokePendingInvitations(OrganizationMember member, CancellationToken cancellationToken)
    {
        var pending = await db.Invitations.Where(x => x.OrganizationId == member.OrganizationId &&
            x.PersonnelMemberId == member.Id && x.State == "PENDING").ToListAsync(cancellationToken);
        foreach (var invitation in pending) invitation.State = "REVOKED";
    }

    public async Task<object> State(OrganizationActor actor, Guid id, Guid memberId, MemberStateRequest request, CancellationToken cancellationToken)
    {
        await access.Require(id, actor, false, "OWNER");
        var member = await EditableMember(id, memberId, actor.UserId, cancellationToken);
        WorkspaceAccess.Match(member.Version, request.Version);
        if (member.UserId is null) throw new ApiException(409, "Nhân sự chưa liên kết tài khoản.");
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

    private async Task<OrganizationMember> FindMember(Guid id, Guid memberId, CancellationToken cancellationToken) =>
        await db.Members.Include(x => x.Roles).SingleOrDefaultAsync(x => x.OrganizationId == id && x.Id == memberId, cancellationToken)
            ?? throw new ApiException(404, "Không tìm thấy thành viên.");

    private async Task<OrganizationMember> EditableMember(Guid id, Guid memberId, Guid actorId, CancellationToken cancellationToken)
    {
        var member = await FindMember(id, memberId, cancellationToken);
        if (member.Role == "OWNER" || member.UserId == actorId) throw new ApiException(400, "Không được thay đổi hoặc khóa OWNER bằng chức năng nhân sự.");
        return member;
    }
}
