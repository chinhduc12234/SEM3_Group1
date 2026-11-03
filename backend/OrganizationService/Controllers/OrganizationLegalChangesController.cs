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
using Shared;

namespace OrganizationService.Controllers;

[ApiController, Authorize, Route("api/organizations"), EnableRateLimiting("organization")]
public sealed class OrganizationLegalChangesController(OrganizationDb db, WorkspaceAccess access, IDataProtectionProvider protection) : ControllerBase
{
    private Guid Actor => WorkspaceAccess.Actor(User);
    private readonly IDataProtector requests = protection.CreateProtector("GiveAid.Organization.LegalChange.v1");
    private readonly IDataProtector documents = protection.CreateProtector("GiveAid.Organization.PrivateDocuments.v1");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [HttpGet("{id:guid}/workspace/legal-changes")]
    public async Task<IActionResult> List(Guid id, [FromQuery, Range(1, 100000)] int page = 1)
    {
        await access.Require(id, User, true, "OWNER");
        var query = db.LegalChanges.AsNoTracking().Where(x => x.OrganizationId == id);
        return Ok(new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = await query.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.State, x.Reason, x.CreatedAt, x.ReviewedAt, x.ReviewReason, version = Convert.ToBase64String(x.Version) }).ToListAsync() });
    }

    [Authorize(Roles = "ADMIN"), HttpGet("admin/legal-changes")]
    public async Task<IActionResult> Pending([FromQuery, Range(1, 100000)] int page = 1)
    {
        var query = db.LegalChanges.AsNoTracking().Where(x => x.State == "PENDING");
        return Ok(new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = await query.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.OrganizationId, x.Reason, x.CreatedAt,
                    organizationName = db.Organizations.Where(o => o.Id == x.OrganizationId).Select(o => o.Profile.LegalName).First() }).ToListAsync() });
    }

    [HttpGet("{id:guid}/workspace/legal-changes/{changeId:guid}")]
    public async Task<IActionResult> Detail(Guid id, Guid changeId)
    {
        await access.Require(id, User, true, "OWNER");
        var change = await Find(id, changeId);
        return Ok(new { change.Id, change.State, change.Reason, change.CreatedAt, change.ReviewedAt, change.ReviewReason,
            proposed = JsonSerializer.Deserialize<OrganizationRequest>(requests.Unprotect(change.ProtectedRequest), Json),
            version = Convert.ToBase64String(change.Version),
            documents = change.Documents.Select(x => new { x.Id, x.Kind, x.FileName }) });
    }

    [HttpPost("{id:guid}/workspace/legal-changes"), RequestSizeLimit(17 * 1024 * 1024)]
    public async Task<IActionResult> Create(Guid id, [FromForm, Required] string proposal, [FromForm, Required, StringLength(2000, MinimumLength = 3)] string reason,
        [FromForm, Required] IFormFile registration, [FromForm, Required] IFormFile representativeId, [FromForm, Required] IFormFile authorization,
        CancellationToken cancellationToken)
    {
        var organization = await access.Require(id, User, false, "OWNER");
        OrganizationRequest request;
        try { request = JsonSerializer.Deserialize<OrganizationRequest>(proposal, Json) ?? throw new JsonException(); }
        catch (JsonException) { throw new ApiException(400, "Nội dung yêu cầu không hợp lệ."); }
        Validate(request);
        OrganizationPolicy.MatchVersion(organization, request.Version);
        if (reason.Trim().Length < 3) throw new ApiException(400, "Cần ghi rõ lý do thay đổi.");
        if (await db.LegalChanges.AnyAsync(x => x.OrganizationId == id && x.State == "PENDING", cancellationToken)) throw new ApiException(409, "Đã có một yêu cầu pháp lý đang chờ xét duyệt.");
        var change = new OrganizationLegalChange { OrganizationId = id, RequestedBy = Actor, Reason = reason.Trim(), ProtectedRequest = requests.Protect(JsonSerializer.Serialize(request, Json)) };
        foreach (var (kind, file) in new[] { ("REGISTRATION", registration), ("REPRESENTATIVE_ID", representativeId), ("AUTHORIZATION", authorization) })
        {
            var upload = await OrganizationFiles.Read(file, false, 5 * 1024 * 1024, cancellationToken);
            change.Documents.Add(new LegalChangeDocument { Kind = kind, FileName = kind.ToLowerInvariant() + upload.Extension,
                ContentType = upload.ContentType, ProtectedContent = documents.Protect(upload.Bytes) });
        }
        db.LegalChanges.Add(change);
        access.Audit(id, Actor, "LEGAL_CHANGE_REQUESTED", new { change.Id });
        await access.Save(cancellationToken);
        return Created($"/api/organizations/{id}/workspace/legal-changes/{change.Id}", new { change.Id, change.State });
    }

    [HttpGet("{id:guid}/workspace/legal-changes/{changeId:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> Download(Guid id, Guid changeId, Guid documentId)
    {
        await access.Require(id, User, true, "OWNER");
        var change = await Find(id, changeId);
        var document = change.Documents.SingleOrDefault(x => x.Id == documentId) ?? throw new ApiException(404, "Không tìm thấy giấy tờ.");
        return File(documents.Unprotect(document.ProtectedContent), document.ContentType, document.FileName);
    }

    [Authorize(Roles = "ADMIN"), HttpPost("{id:guid}/workspace/legal-changes/{changeId:guid}/review")]
    public async Task<IActionResult> Review(Guid id, Guid changeId, LegalChangeReviewRequest request, CancellationToken cancellationToken)
    {
        var organization = await access.Require(id, User);
        var change = await Find(id, changeId);
        WorkspaceAccess.Match(change.Version, request.Version);
        if (change.State != "PENDING") throw new ApiException(409, "Yêu cầu đã được xét duyệt.");
        if (change.RequestedBy == Actor || organization.ApplicantUserId == Actor) throw new ApiException(403, "Không được tự duyệt yêu cầu của mình.");
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
        change.ReviewedBy = Actor; change.ReviewedAt = DateTimeOffset.UtcNow; change.ReviewReason = request.Reason.Trim();
        access.Audit(id, Actor, "LEGAL_CHANGE_" + change.State, new { change.Id });
        await access.Save(cancellationToken);
        return Ok(new { change.State });
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
