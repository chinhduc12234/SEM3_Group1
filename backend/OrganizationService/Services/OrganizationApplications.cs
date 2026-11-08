using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using OrganizationService.Contracts;
using static OrganizationService.Services.OrganizationPolicy;
using Shared;

namespace OrganizationService.Services;

public sealed class OrganizationApplications(OrganizationDb db, IDataProtectionProvider protection, OrganizationEmailQueue emails, OrganizationNotificationQueue notifications)
{
    private readonly IDataProtector protector = protection.CreateProtector("GiveAid.Organization.PrivateDocuments.v1");

    public async Task<object> Mine(OrganizationActor actor) => await db.Organizations.AsNoTracking().Where(x => x.ApplicantUserId == actor.UserId)
        .OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.Profile.LegalName, x.Status, x.CreatedAt, x.UpdatedAt }).ToListAsync();

    public async Task<object> List(int page,
        string search, string status)
    {
        var query = db.Organizations.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Profile.LegalName.Contains(search) || x.Profile.RegistrationNumber.Contains(search));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        return new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = await query.OrderByDescending(x => x.SubmittedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.Profile.LegalName, x.Profile.RegistrationNumber, x.Status, x.SubmittedAt, x.CreatedAt }).ToListAsync() };
    }

    public async Task<object> Detail(OrganizationActor actor, Guid id) => View(await Find(id, actor));

    public async Task<(Guid Id, object Body)> Create(OrganizationActor actor, OrganizationRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        var organization = new Organization { ApplicantUserId = actor.UserId, Profile = request.Profile, RegistrationKey = Key(request.Profile.RegistrationNumber),
            ProtectedIdentityNumber = protector.Protect(request.IdentityNumber.Trim()), Consent = request.Consent };
        Audit(organization, actor.UserId, "CREATED", "");
        db.Organizations.Add(organization);
        await Save(cancellationToken);
        return (organization.Id, View(organization));
    }

    public async Task<object> Update(OrganizationActor actor, Guid id, OrganizationRequest request, CancellationToken cancellationToken)
    {
        var organization = await Find(id, actor);
        EnsureEditable(organization, actor.UserId);
        MatchVersion(organization, request.Version);
        Validate(request);
        organization.Profile = request.Profile;
        organization.RegistrationKey = Key(request.Profile.RegistrationNumber);
        organization.ProtectedIdentityNumber = protector.Protect(request.IdentityNumber.Trim());
        organization.Consent = request.Consent;
        Audit(organization, actor.UserId, "UPDATED", "");
        await Save(cancellationToken);
        return View(organization);
    }

    public async Task<object> Upload(OrganizationActor actor, Guid id, string kind, OrganizationUpload file, string version, CancellationToken cancellationToken)
    {
        var organization = await Find(id, actor);
        EnsureEditable(organization, actor.UserId);
        MatchVersion(organization, version);
        if (!RequiredDocuments.Contains(kind)) throw new ApiException(400, "Loại giấy tờ không hợp lệ.");
        if (file.Length is <= 0 or > 5 * 1024 * 1024) throw new ApiException(400, "Mỗi tệp phải có dung lượng từ 1 byte đến 5 MB.");
        using var stream = new MemoryStream();
        using var content = file.OpenReadStream();
        await content.CopyToAsync(stream, cancellationToken);
        var bytes = stream.ToArray();
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        // Check magic bytes and extension, not the untrusted browser MIME header.
        var type = extension switch
        {
            ".pdf" when bytes.AsSpan().StartsWith("%PDF-"u8) => "application/pdf",
            ".jpg" or ".jpeg" when bytes.AsSpan().StartsWith(new byte[] { 0xff, 0xd8, 0xff }) => "image/jpeg",
            ".png" when bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) => "image/png",
            _ => throw new ApiException(400, "Chỉ chấp nhận PDF, JPG hoặc PNG có định dạng hợp lệ.")
        };
        var document = organization.Documents.SingleOrDefault(x => x.Kind == kind);
        if (document is null) { document = new OrganizationDocument { Kind = kind, OrganizationId = id }; organization.Documents.Add(document); db.Documents.Add(document); }
        // SQL stores encrypted bytes. No private document is served as a static/public file.
        document.ProtectedContent = protector.Protect(bytes);
        document.FileName = $"{kind.ToLowerInvariant()}{extension}";
        document.ContentType = type; document.Size = bytes.Length; document.UploadedAt = DateTimeOffset.UtcNow;
        Audit(organization, actor.UserId, "DOCUMENT_UPDATED", kind);
        await Save(cancellationToken);
        return View(organization);
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> Download(OrganizationActor actor, Guid id, Guid documentId)
    {
        var organization = await Find(id, actor);
        var document = await db.Documents.SingleOrDefaultAsync(x => x.OrganizationId == id && x.Id == documentId)
            ?? throw new ApiException(404, "Không tìm thấy tệp.");
        return (protector.Unprotect(document.ProtectedContent), document.ContentType, document.FileName);
    }

    public async Task<object> Submit(OrganizationActor actor, Guid id, VersionRequest request, CancellationToken cancellationToken)
    {
        var organization = await Find(id, actor);
        EnsureEditable(organization, actor.UserId);
        MatchVersion(organization, request.Version);
        EnsureReadyToSubmit(organization);
        organization.Status = "PENDING_REVIEW"; organization.SubmittedAt = DateTimeOffset.UtcNow;
        Audit(organization, actor.UserId, "SUBMITTED", "");
        await Save(cancellationToken);
        return View(organization);
    }

    public async Task<object> Review(OrganizationActor actor, Guid id, ReviewRequest request, CancellationToken cancellationToken)
    {
        var organization = await Find(id, actor);
        MatchVersion(organization, request.Version);
        organization.Status = ReviewStatus(organization, actor.UserId, request.Decision, request.Reason);
        if (request.Decision == "APPROVE")
        {
            db.Members.Add(new OrganizationMember { OrganizationId = id, UserId = organization.ApplicantUserId, Role = "OWNER",
                Roles = [new OrganizationMemberRole { Role = "OWNER" }] });
            db.Workspaces.Add(WorkspaceAccess.Initial(organization));
        }
        Audit(organization, actor.UserId, request.Decision, request.Reason?.Trim() ?? "");
        // Member creation, review history and state transition commit in one transaction.
        await Save(cancellationToken);
        return View(organization);
    }

    private async Task<Organization> Find(Guid id, OrganizationActor actor)
    {
        var organization = await db.Organizations.Include(x => x.Reviews).Include(x => x.Documents).AsSplitQuery().SingleOrDefaultAsync(x => x.Id == id && (actor.IsAdmin || x.ApplicantUserId == actor.UserId))
            ?? throw new ApiException(404, "Không tìm thấy hồ sơ.");
        return organization;
    }
    private void Audit(Organization organization, Guid userId, string action, string reason)
    {
        organization.UpdatedAt = DateTimeOffset.UtcNow;
        var entry = new OrganizationReview { OrganizationId = organization.Id, ActorUserId = userId, Action = action, Reason = reason };
        organization.Reviews.Add(entry);
        db.Add(entry);
        if (action is "SUBMITTED" or "APPROVE" or "REQUEST_CHANGES" or "REJECT")
        {
            emails.Enqueue(organization, entry);
            notifications.Enqueue(organization, entry);
        }
    }
    private async Task Save(CancellationToken cancellationToken)
    {
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(409, "Hồ sơ đã được người khác xử lý. Vui lòng tải lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        {
            if (db.ChangeTracker.Entries<OrganizationMember>().Any(x => x.State == EntityState.Added))
                throw new ApiException(409, "Hồ sơ đã được người khác xử lý. Vui lòng tải lại.");
            throw new ApiException(409, "Số đăng ký đã có hồ sơ trên hệ thống.");
        }
    }
    private object View(Organization organization) => new
    {
        organization.Id, organization.Profile, IdentityNumber = protector.Unprotect(organization.ProtectedIdentityNumber), organization.Status,
        organization.Consent, organization.CreatedAt, organization.UpdatedAt, organization.SubmittedAt, Version = Convert.ToBase64String(organization.Version),
        organization.ApplicantUserId,
        documents = organization.Documents.Select(x => new { x.Id, x.Kind, x.FileName, x.Size, x.UploadedAt }),
        history = organization.Reviews.OrderByDescending(x => x.At).Select(x => new { x.Action, x.Reason, x.At, x.ActorUserId })
    };
}
