using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using OrganizationService.Contracts;
using static OrganizationService.Services.OrganizationPolicy;
using Shared;

namespace OrganizationService.Controllers;


[ApiController, Authorize, Route("api/organizations"), EnableRateLimiting("organization")]
public sealed class OrganizationsController(OrganizationDb db, IDataProtectionProvider protection) : ControllerBase
{
    private readonly IDataProtector protector = protection.CreateProtector("GiveAid.Organization.PrivateDocuments.v1");
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    private bool Admin => User.IsInRole("ADMIN");

    [HttpGet("mine")]
    public async Task<IActionResult> Mine() => Ok(await db.Organizations.AsNoTracking().Where(x => x.ApplicantUserId == Actor)
        .OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.Profile.LegalName, x.Status, x.CreatedAt, x.UpdatedAt }).ToListAsync());

    [Authorize(Roles = "ADMIN"), HttpGet]
    public async Task<IActionResult> List([FromQuery, Range(1, 100000)] int page = 1,
        [FromQuery, MaxLength(100)] string search = "", [FromQuery, MaxLength(30)] string status = "")
    {
        var query = db.Organizations.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Profile.LegalName.Contains(search) || x.Profile.RegistrationNumber.Contains(search));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        return Ok(new { totalCount = await query.CountAsync(), page, pageSize = 20,
            items = await query.OrderByDescending(x => x.SubmittedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.Profile.LegalName, x.Profile.RegistrationNumber, x.Status, x.SubmittedAt, x.CreatedAt }).ToListAsync() });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detail(Guid id) => Ok(View(await Find(id)));

    [HttpPost]
    public async Task<IActionResult> Create(OrganizationRequest request)
    {
        Validate(request);
        var organization = new Organization { ApplicantUserId = Actor, Profile = request.Profile, RegistrationKey = Key(request.Profile.RegistrationNumber),
            ProtectedIdentityNumber = protector.Protect(request.IdentityNumber.Trim()), Consent = request.Consent };
        Audit(organization, "CREATED", "");
        db.Organizations.Add(organization);
        await Save();
        return Created($"/api/organizations/{organization.Id}", View(organization));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, OrganizationRequest request)
    {
        var organization = await Find(id);
        EnsureEditable(organization, Actor);
        MatchVersion(organization, request.Version);
        Validate(request);
        organization.Profile = request.Profile;
        organization.RegistrationKey = Key(request.Profile.RegistrationNumber);
        organization.ProtectedIdentityNumber = protector.Protect(request.IdentityNumber.Trim());
        organization.Consent = request.Consent;
        Audit(organization, "UPDATED", "");
        await Save();
        return Ok(View(organization));
    }

    [HttpPost("{id:guid}/documents/{kind}"), RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid id, string kind, [Required] IFormFile file, [FromForm, Required] string version)
    {
        var organization = await Find(id);
        EnsureEditable(organization, Actor);
        MatchVersion(organization, version);
        if (!RequiredDocuments.Contains(kind)) throw new ApiException(400, "Loại giấy tờ không hợp lệ.");
        if (file.Length is <= 0 or > 5 * 1024 * 1024) throw new ApiException(400, "Mỗi tệp phải có dung lượng từ 1 byte đến 5 MB.");
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream, HttpContext.RequestAborted);
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
        Audit(organization, "DOCUMENT_UPDATED", kind);
        await Save();
        return Ok(View(organization));
    }

    [HttpGet("{id:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> Download(Guid id, Guid documentId)
    {
        var organization = await Find(id);
        var document = await db.Documents.SingleOrDefaultAsync(x => x.OrganizationId == id && x.Id == documentId)
            ?? throw new ApiException(404, "Không tìm thấy tệp.");
        return File(protector.Unprotect(document.ProtectedContent), document.ContentType, document.FileName);
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, VersionRequest request)
    {
        var organization = await Find(id);
        EnsureEditable(organization, Actor);
        MatchVersion(organization, request.Version);
        EnsureReadyToSubmit(organization);
        organization.Status = "PENDING_REVIEW"; organization.SubmittedAt = DateTimeOffset.UtcNow;
        Audit(organization, "SUBMITTED", "");
        await Save();
        return Ok(View(organization));
    }

    [Authorize(Roles = "ADMIN"), HttpPost("{id:guid}/review")]
    public async Task<IActionResult> Review(Guid id, ReviewRequest request)
    {
        var organization = await Find(id);
        MatchVersion(organization, request.Version);
        organization.Status = ReviewStatus(organization, Actor, request.Decision, request.Reason);
        if (request.Decision == "APPROVE")
            db.Members.Add(new OrganizationMember { OrganizationId = id, UserId = organization.ApplicantUserId, Role = "OWNER" });
        Audit(organization, request.Decision, request.Reason?.Trim() ?? "");
        // Member creation, review history and state transition commit in one transaction.
        await Save();
        return Ok(View(organization));
    }

    private async Task<Organization> Find(Guid id)
    {
        var organization = await db.Organizations.Include(x => x.Reviews).Include(x => x.Documents).AsSplitQuery().SingleOrDefaultAsync(x => x.Id == id && (Admin || x.ApplicantUserId == Actor))
            ?? throw new ApiException(404, "Không tìm thấy hồ sơ.");
        return organization;
    }
    private void Audit(Organization organization, string action, string reason)
    {
        organization.UpdatedAt = DateTimeOffset.UtcNow;
        var entry = new OrganizationReview { OrganizationId = organization.Id, ActorUserId = Actor, Action = action, Reason = reason };
        organization.Reviews.Add(entry);
        db.Add(entry);
    }
    private async Task Save()
    {
        try { await db.SaveChangesAsync(HttpContext.RequestAborted); }
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
