using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Contracts;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Services;

public sealed class OrganizationLegalChanges(OrganizationDb db, WorkspaceAccess access, IDataProtectionProvider protection)
{
    private readonly IDataProtector requests = protection.CreateProtector("GiveAid.Organization.LegalChange.v1");
    private readonly IDataProtector documents = protection.CreateProtector("GiveAid.Organization.PrivateDocuments.v1");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<object> List(OrganizationActor actor, Guid id, int page)
    {
        await access.Require(id, actor, true, "OWNER");
        var query = db.LegalChanges.AsNoTracking().Where(x => x.OrganizationId == id);
        return new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = await query.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.State, x.Reason, x.CreatedAt, x.ReviewedAt, x.ReviewReason, version = Convert.ToBase64String(x.Version) }).ToListAsync() };
    }

    public async Task<object> Pending(int page)
    {
        var query = db.LegalChanges.AsNoTracking().Where(x => x.State == "PENDING");
        return new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = await query.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.OrganizationId, x.Reason, x.CreatedAt,
                    organizationName = db.Organizations.Where(o => o.Id == x.OrganizationId).Select(o => o.Profile.LegalName).First() }).ToListAsync() };
    }

    public async Task<object> Detail(OrganizationActor actor, Guid id, Guid changeId)
    {
        await access.Require(id, actor, true, "OWNER");
        var change = await Find(id, changeId);
        return new { change.Id, change.State, change.Reason, change.CreatedAt, change.ReviewedAt, change.ReviewReason,
            proposed = JsonSerializer.Deserialize<OrganizationRequest>(requests.Unprotect(change.ProtectedRequest), Json),
            version = Convert.ToBase64String(change.Version),
            documents = change.Documents.Select(x => new { x.Id, x.Kind, x.FileName }) };
    }

    public async Task<(Guid Id, object Body)> Create(OrganizationActor actor, Guid id, string proposal, string reason,
        OrganizationUpload registration, OrganizationUpload representativeId, OrganizationUpload authorization,
        CancellationToken cancellationToken)
    {
        var organization = await access.Require(id, actor, false, "OWNER");
        OrganizationRequest request;
        try { request = JsonSerializer.Deserialize<OrganizationRequest>(proposal, Json) ?? throw new JsonException(); }
        catch (JsonException) { throw new ApiException(400, "Nội dung yêu cầu không hợp lệ."); }
        Validate(request);
        OrganizationPolicy.MatchVersion(organization, request.Version);
        if (reason.Trim().Length < 3) throw new ApiException(400, "Cần ghi rõ lý do thay đổi.");
        if (await db.LegalChanges.AnyAsync(x => x.OrganizationId == id && x.State == "PENDING", cancellationToken)) throw new ApiException(409, "Đã có một yêu cầu pháp lý đang chờ xét duyệt.");
        var change = new OrganizationLegalChange { OrganizationId = id, RequestedBy = actor.UserId, Reason = reason.Trim(), ProtectedRequest = requests.Protect(JsonSerializer.Serialize(request, Json)) };
        foreach (var (kind, file) in new[] { ("REGISTRATION", registration), ("REPRESENTATIVE_ID", representativeId), ("AUTHORIZATION", authorization) })
        {
            var upload = await OrganizationFiles.Read(file, false, 5 * 1024 * 1024, cancellationToken);
            change.Documents.Add(new LegalChangeDocument { Kind = kind, FileName = kind.ToLowerInvariant() + upload.Extension,
                ContentType = upload.ContentType, ProtectedContent = documents.Protect(upload.Bytes) });
        }
        db.LegalChanges.Add(change);
        access.Audit(id, actor.UserId, "LEGAL_CHANGE_REQUESTED", new { change.Id });
        await access.Save(cancellationToken);
        return (change.Id, new { change.Id, change.State });
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> Download(OrganizationActor actor, Guid id, Guid changeId, Guid documentId)
    {
        await access.Require(id, actor, true, "OWNER");
        var change = await Find(id, changeId);
        var document = change.Documents.SingleOrDefault(x => x.Id == documentId) ?? throw new ApiException(404, "Không tìm thấy giấy tờ.");
        return (documents.Unprotect(document.ProtectedContent), document.ContentType, document.FileName);
    }

    public async Task<object> Review(OrganizationActor actor, Guid id, Guid changeId, LegalChangeReviewRequest request, CancellationToken cancellationToken)
    {
        var organization = await access.Require(id, actor);
        var change = await Find(id, changeId);
        WorkspaceAccess.Match(change.Version, request.Version);
        if (change.State != "PENDING") throw new ApiException(409, "Yêu cầu đã được xét duyệt.");
        if (change.RequestedBy == actor.UserId || organization.ApplicantUserId == actor.UserId) throw new ApiException(403, "Không được tự duyệt yêu cầu của mình.");
        if (request.Reason.Trim().Length < 3) throw new ApiException(400, "Cần ghi rõ nhận xét xét duyệt.");
        if (request.Decision == "APPROVE")
        {
            var proposal = JsonSerializer.Deserialize<OrganizationRequest>(requests.Unprotect(change.ProtectedRequest), Json)!;
            Validate(proposal);
            OrganizationPolicy.MatchVersion(organization, proposal.Version);
            var current = await db.Documents.Where(x => x.OrganizationId == id).ToListAsync(cancellationToken);
            change.ProtectedPreviousDossier = requests.Protect(JsonSerializer.Serialize(new
            {
                organization.Profile, organization.ProtectedIdentityNumber,
                documents = current.Select(x => new { x.Kind, x.FileName, x.ContentType, x.ProtectedContent, x.UploadedAt })
            }, Json));
            organization.Profile = proposal.Profile;
            organization.RegistrationKey = OrganizationPolicy.Key(proposal.Profile.RegistrationNumber);
            organization.ProtectedIdentityNumber = documents.Protect(proposal.IdentityNumber.Trim());
            organization.UpdatedAt = DateTimeOffset.UtcNow;
            // Preserve the previous encrypted dossier above; keep the proposed documents on this amendment.
            foreach (var source in change.Documents)
            {
                var document = current.SingleOrDefault(x => x.Kind == source.Kind);
                if (document is null) { document = new OrganizationDocument { OrganizationId = id, Kind = source.Kind }; db.Documents.Add(document); }
                document.ProtectedContent = source.ProtectedContent; document.ContentType = source.ContentType;
                document.FileName = source.FileName; document.Size = documents.Unprotect(source.ProtectedContent).Length; document.UploadedAt = DateTimeOffset.UtcNow;
            }
        }
        change.State = request.Decision == "APPROVE" ? "APPROVED" : "REJECTED";
        change.ReviewedBy = actor.UserId; change.ReviewedAt = DateTimeOffset.UtcNow; change.ReviewReason = request.Reason.Trim();
        access.Audit(id, actor.UserId, "LEGAL_CHANGE_" + change.State, new { change.Id });
        await access.Save(cancellationToken);
        return new { change.State };
    }

    private async Task<OrganizationLegalChange> Find(Guid id, Guid changeId) => await db.LegalChanges.Include(x => x.Documents)
        .SingleOrDefaultAsync(x => x.OrganizationId == id && x.Id == changeId) ?? throw new ApiException(404, "Không tìm thấy yêu cầu pháp lý.");

    private static void Validate(OrganizationRequest request)
    {
        var errors = new List<ValidationResult>();
        if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, true) || request.Profile is null ||
            !Validator.TryValidateObject(request.Profile, new ValidationContext(request.Profile), errors, true))
            throw new ApiException(400, "Thông tin pháp lý chưa đầy đủ hoặc sai định dạng.");
        OrganizationPolicy.Validate(request);
    }
}
