using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Services;

public sealed record OwnerOrganizationSummary(Guid Id, string LegalName, string Status, string Province, DateTimeOffset OwnerSince);
public sealed record OwnerDirectoryItem(Guid Id, string FullName, string Email, bool IsActive, int OrganizationCount, DateTimeOffset OwnerSince, OwnerOrganizationSummary[] Organizations);
public sealed record OwnerDocument(Guid Id, string Kind, string FileName, long Size, DateTimeOffset UploadedAt);
public sealed record OwnerOrganizationProfile(Guid Id, string Status, DateTimeOffset CreatedAt, DateTimeOffset? SubmittedAt,
    DateTimeOffset OwnerSince, OrganizationProfile Profile, string IdentityNumber, OwnerDocument[] Documents,
    object[] History);

public sealed class OwnerProfileDirectory(OrganizationDb db, IdentityDirectory identity, IDataProtectionProvider protection)
{
    private readonly IDataProtector protector = protection.CreateProtector("GiveAid.Organization.PrivateDocuments.v1");

    public async Task<object> List(int page, string search, CancellationToken cancellationToken)
    {
        var memberships = await db.Members.AsNoTracking()
            .Where(x => x.IsActive && x.Role == "OWNER")
            .Select(x => new
            {
                x.UserId,
                x.JoinedAt,
                Organization = new OwnerOrganizationSummary(x.OrganizationId, x.Organization.Profile.LegalName,
                    x.Organization.Status, x.Organization.Profile.Province, x.JoinedAt)
            }).ToListAsync(cancellationToken);

        var accounts = await identity.Read(memberships.Select(x => x.UserId), cancellationToken);
        var owners = memberships.GroupBy(x => x.UserId).Select(group =>
        {
            accounts.TryGetValue(group.Key, out var account);
            var organizations = group.Select(x => x.Organization).OrderBy(x => x.LegalName).ToArray();
            return account is null ? null : new OwnerDirectoryItem(group.Key, account.FullName, account.Email,
                account.IsActive, organizations.Length, organizations.Min(x => x.OwnerSince), organizations);
        }).Where(x => x is not null).Select(x => x!).ToList();

        var term = search.Trim();
        if (term.Length > 0)
            owners = owners.Where(x => x.FullName.Contains(term, StringComparison.OrdinalIgnoreCase)
                || x.Email.Contains(term, StringComparison.OrdinalIgnoreCase)
                || x.Organizations.Any(o => o.LegalName.Contains(term, StringComparison.OrdinalIgnoreCase)))
                .ToList();

        var ordered = owners.OrderBy(x => x.FullName, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.Id).ToList();
        return new { totalCount = ordered.Count, page, pageSize = 20, items = ordered.Skip((page - 1) * 20).Take(20) };
    }

    public async Task<object> Detail(Guid ownerId, CancellationToken cancellationToken)
    {
        var memberships = await db.Members.AsNoTracking()
            .Where(x => x.UserId == ownerId && x.IsActive && x.Role == "OWNER")
            .Select(x => new { x.OrganizationId, x.JoinedAt })
            .ToListAsync(cancellationToken);
        if (memberships.Count == 0) throw new ApiException(404, "Không tìm thấy hồ sơ Owner.");

        var accounts = await identity.Read([ownerId], cancellationToken);
        if (!accounts.TryGetValue(ownerId, out var account)) throw new ApiException(404, "Không tìm thấy tài khoản Owner.");
        var organizationIds = memberships.Select(x => x.OrganizationId).ToArray();
        var organizations = await db.Organizations.AsNoTracking()
            .Where(x => organizationIds.Contains(x.Id) && x.ApplicantUserId == ownerId)
            .Include(x => x.Documents).Include(x => x.Reviews)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        var joinedAt = memberships.GroupBy(x => x.OrganizationId).ToDictionary(x => x.Key, x => x.Min(y => y.JoinedAt));
        var profiles = organizations.Select(x => new OwnerOrganizationProfile(
            x.Id, x.Status, x.CreatedAt, x.SubmittedAt, joinedAt.GetValueOrDefault(x.Id), x.Profile,
            protector.Unprotect(x.ProtectedIdentityNumber),
            x.Documents.OrderBy(d => d.Kind).Select(d => new OwnerDocument(d.Id, d.Kind, d.FileName, d.Size, d.UploadedAt)).ToArray(),
            x.Reviews.OrderByDescending(r => r.At).Select(r => (object)new { r.Action, r.Reason, r.At }).ToArray()
        )).ToArray();

        return new
        {
            account = new { account.Id, account.FullName, account.Email, account.IsActive },
            role = "OWNER",
            ownerSince = memberships.Min(x => x.JoinedAt),
            organizations = profiles
        };
    }
}
