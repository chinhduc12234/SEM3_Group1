using CampaignService.Contracts;
using CampaignService.Data;
using CampaignService.Repositories;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace CampaignService.Services;

public sealed class CampaignApplication(ICampaignRepository repository, IOrganizationAccess access, IConfiguration configuration) : ICampaignApplication
{
    private static readonly string[] Managers = ["CAMPAIGN_MANAGER"];
    private static readonly string[] Readers = ["CAMPAIGN_MANAGER", "OWNER"];
    public static CampaignView View(Campaign c, bool history = true) => new(c.Id, c.OrganizationId, c.CreatedBy,
        c.Title, c.Description, c.CampaignType, c.Cause, c.BeneficiaryDescription, c.GoalAmount, c.VolunteerTarget,
        c.StartDate, c.EndDate, c.Location, c.ContactEmail, c.ContactPhone, c.Status, Convert.ToBase64String(c.Version),
        c.CreatedAt, c.SubmittedAt, c.PublishedAt,
        c.Media.Where(m => history || m.Kind != "DOCUMENT" || c.Status == "PUBLISHED").Select(m => (object)new { m.Id, m.Kind, m.FileName, m.ContentType }).ToArray(),
        history ? c.Reviews.OrderBy(x => x.CreatedAt).Select(r => (object)new { r.Action, r.Note, r.ActorId, r.CreatedAt }).ToArray() : [],
        !string.IsNullOrWhiteSpace(c.AdditionalDetails) ? c.AdditionalDetails : "{}");
    public static void Match(Campaign c, string version)
    {
        if (string.IsNullOrEmpty(version) || Convert.ToBase64String(c.Version) != version) throw new ApiException(409, "Chiến dịch đã thay đổi. Vui lòng tải lại.");
    }
    private static void Validate(CampaignRequest r)
    {
        if (r.Title.Trim().Length < 3 || r.Description.Trim().Length < 1 || r.BeneficiaryDescription.Trim().Length < 1 || r.Location.Trim().Length < 3)
            throw new ApiException(400, "Vui lòng nhập đầy đủ nội dung chiến dịch.");
        if (r.OrganizationId == Guid.Empty || r.StartDate == default || r.EndDate == default || r.EndDate < r.StartDate)
            throw new ApiException(400, "Tổ chức hoặc khoảng thời gian chiến dịch không hợp lệ.");
        if (r.EndDate < DateOnly.FromDateTime(DateTime.UtcNow)) throw new ApiException(400, "Ngày kết thúc không được ở quá khứ.");
        if (r.GoalAmount != decimal.Round(r.GoalAmount, 2)) throw new ApiException(400, "Số tiền có tối đa hai chữ số thập phân.");
    }
    private static void Apply(Campaign c, CampaignRequest r)
    {
        c.Title = r.Title.Trim(); c.Description = r.Description.Trim(); c.CampaignType = "COMBINED"; c.Cause = r.Cause;
        c.BeneficiaryDescription = r.BeneficiaryDescription.Trim(); c.GoalAmount = r.GoalAmount; c.VolunteerTarget = r.VolunteerTarget;
        c.StartDate = r.StartDate; c.EndDate = r.EndDate; c.Location = r.Location.Trim();
        c.ContactEmail = (r.ContactEmail?.Trim() ?? ""); c.ContactPhone = r.ContactPhone.Trim(); c.UpdatedAt = DateTimeOffset.UtcNow;
        c.AdditionalDetails = string.IsNullOrWhiteSpace(r.AdditionalDetails) ? "{}" : r.AdditionalDetails;
    }
    private static void Audit(Campaign c, Guid actor, string action, string note = "") => c.Reviews.Add(new()
        { CampaignId = c.Id, ActorId = actor, Action = action, Note = note });
    public async Task<Campaign> Get(Guid id, CancellationToken ct) => await repository.Find(id, ct) ?? throw new ApiException(404, "Không tìm thấy chiến dịch.");
    public async Task<CampaignView> Create(CampaignRequest r, Guid actor, CancellationToken ct)
    {
        Validate(r); await access.Require(r.OrganizationId, actor, Managers, ct);
        var c = new Campaign { OrganizationId = r.OrganizationId, CreatedBy = actor };
        Apply(c, r); Audit(c, actor, "CREATE"); repository.Add(c); await repository.Save(ct); return View(c);
    }
    public async Task<CampaignView> Update(Guid id, CampaignRequest r, Guid actor, CancellationToken ct)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, Managers, ct); Match(c, r.Version); Validate(r);
        if (c.OrganizationId != r.OrganizationId) throw new ApiException(400, "Không được chuyển tổ chức sở hữu.");
        if (c.Status == "PUBLISHED")
        {
            if (c.CampaignType != r.CampaignType || c.Cause != r.Cause || c.BeneficiaryDescription != r.BeneficiaryDescription.Trim()
                || c.GoalAmount != r.GoalAmount || c.VolunteerTarget != r.VolunteerTarget || c.StartDate != r.StartDate || c.EndDate != r.EndDate
                || c.Location != r.Location.Trim() || c.ContactEmail != (r.ContactEmail?.Trim() ?? "") || c.ContactPhone != r.ContactPhone.Trim())
                throw new ApiException(400, "Sau khi duyệt chỉ được sửa tên và mô tả. Thông tin liên hệ, mục tiêu và phạm vi chiến dịch đã khóa.");
            c.Title = r.Title.Trim(); c.Description = r.Description.Trim(); c.UpdatedAt = DateTimeOffset.UtcNow;
            Audit(c, actor, "CONTENT_UPDATED"); await repository.Save(ct); return View(c);
        }
        if (c.Status is not ("DRAFT" or "NEEDS_REVISION" or "PENDING_REVIEW"))
            throw new ApiException(409, "Chỉ được sửa bản nháp, hồ sơ cần bổ sung hoặc chiến dịch đang chờ Owner duyệt.");
        var pendingReview = c.Status == "PENDING_REVIEW";
        Apply(c, r);
        if (pendingReview) c.SubmittedAt = c.UpdatedAt;
        Audit(c, actor, pendingReview ? "SUBMISSION_UPDATED" : "UPDATE");
        await repository.Save(ct); return View(c);
    }
    public async Task Delete(Guid id, string version, Guid actor, CancellationToken ct)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, Managers, ct); Match(c, version);
        if (c.Status is not ("DRAFT" or "NEEDS_REVISION" or "REJECTED"))
            throw new ApiException(409, "Chỉ có thể xóa bản nháp, hồ sơ cần chỉnh sửa hoặc chiến dịch bị từ chối.");
        repository.Remove(c); await repository.Save(ct);
    }
    public async Task<CampaignView> Submit(Guid id, string version, Guid actor, CancellationToken ct)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, Managers, ct); Match(c, version);
        if (c.Status is not ("DRAFT" or "NEEDS_REVISION")) throw new ApiException(409, "Trạng thái không cho phép gửi duyệt.");
        if (c.EndDate < DateOnly.FromDateTime(DateTime.UtcNow)) throw new ApiException(400, "Chiến dịch đã hết thời gian.");
        c.Status = "PENDING_REVIEW"; c.SubmittedAt = c.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(c, actor, "SUBMIT"); await repository.Save(ct); return View(c);
    }
    public async Task<CampaignView> Review(Guid id, ReviewRequest r, Guid actor, CancellationToken ct)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, ["OWNER"], ct); Match(c, r.Version);
        if (c.CreatedBy == actor) throw new ApiException(403, "Người tạo không được tự duyệt chiến dịch.");
        if (c.Status != "PENDING_REVIEW") throw new ApiException(409, "Chiến dịch chưa ở trạng thái chờ duyệt.");
        if (r.Decision != "APPROVE" && string.IsNullOrWhiteSpace(r.Note)) throw new ApiException(400, "Vui lòng nhập lý do yêu cầu sửa hoặc từ chối.");
        if (r.Decision == "APPROVE" && c.EndDate < DateOnly.FromDateTime(DateTime.UtcNow)) throw new ApiException(400, "Chiến dịch đã hết thời gian.");
        c.Status = r.Decision switch { "APPROVE" => "PUBLISHED", "REQUEST_CHANGES" => "NEEDS_REVISION", "REJECT" => "REJECTED", _ => throw new ApiException(400, "Quyết định không hợp lệ.") };
        c.UpdatedAt = DateTimeOffset.UtcNow; if (c.Status == "PUBLISHED") c.PublishedAt = c.UpdatedAt;
        Audit(c, actor, r.Decision, r.Note.Trim()); await repository.Save(ct); return View(c);
    }
    public async Task<object> List(Guid? org, Guid? actor, int page, string? search, string? cause, CancellationToken ct, int pageSize = 20)
    {
        var query = repository.Query.AsNoTracking();
        if (org.HasValue) { await access.Require(org.Value, actor!.Value, Readers, ct); query = query.Where(x => x.OrganizationId == org.Value); }
        else query = query.Where(x => x.Status == "PUBLISHED");
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Title.Contains(search));
        if (!string.IsNullOrWhiteSpace(cause)) query = query.Where(x => x.Cause == cause);
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100); var count = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { x.Id, x.OrganizationId, x.Title, x.Description, x.CampaignType, x.Cause, x.GoalAmount, x.VolunteerTarget, x.StartDate, x.EndDate, x.Location, x.Status,
                coverMediaId = x.Media.Where(m => m.Kind == "COVER").Select(m => (Guid?)m.Id).FirstOrDefault() }).ToListAsync(ct);
        return new { items = rows, totalCount = count, page, pageSize };
    }
    public async Task<CampaignView> Detail(Guid id, Guid? actor, bool management, CancellationToken ct)
    {
        var c = await Get(id, ct);
        if (management) await access.Require(c.OrganizationId, actor ?? throw new ApiException(401, "Vui lòng đăng nhập."), Readers, ct);
        else if (c.Status != "PUBLISHED") throw new ApiException(404, "Không tìm thấy chiến dịch công khai.");
        return View(c, management);
    }
    public async Task<CampaignView> Upload(Guid id, string version, string kind, IFormFile file, Guid actor, CancellationToken ct, Guid? replaceId = null)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, Managers, ct); Match(c, version);
        if (c.Status is not ("DRAFT" or "NEEDS_REVISION" or "PENDING_REVIEW" or "PUBLISHED")) throw new ApiException(409, "Không thể sửa ảnh ở trạng thái hiện tại.");
        if (c.Status == "PUBLISHED" && kind == "DOCUMENT") throw new ApiException(400, "Tài liệu hỗ trợ đã khóa sau khi duyệt.");
        var target = replaceId.HasValue ? c.Media.SingleOrDefault(m => m.Id == replaceId.Value && m.Kind == kind) ?? throw new ApiException(404, "Không tìm thấy ảnh cần thay.") : kind == "COVER" ? c.Media.SingleOrDefault(m => m.Kind == "COVER") : null;
        var maxBytes = kind == "DOCUMENT" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        if (kind is not ("COVER" or "GALLERY" or "DOCUMENT") || file.Length < 8 || file.Length > maxBytes || (target is null && c.Media.Count >= 13))
            throw new ApiException(400, "Loại tệp không hợp lệ, vượt 5 MB hoặc quá 12 tệp.");
        await using var stream = new MemoryStream(); await file.CopyToAsync(stream, ct); var bytes = stream.ToArray();
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var type = bytes.AsSpan().StartsWith(new byte[] {137,80,78,71,13,10,26,10}) ? "image/png"
            : bytes.AsSpan().StartsWith(new byte[] {255,216,255}) ? "image/jpeg"
            : bytes.AsSpan().StartsWith("%PDF-"u8) ? "application/pdf"
            : extension == ".docx" && bytes.AsSpan().StartsWith(new byte[] {0x50,0x4b,0x03,0x04}) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "";
        if (type == "" || (kind != "DOCUMENT" && type is "application/pdf" or "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            || (kind == "DOCUMENT" && type.StartsWith("image/", StringComparison.Ordinal))) throw new ApiException(400, "Ảnh chỉ nhận PNG/JPG; tài liệu chỉ nhận PDF/DOCX.");
        var incomingName = Path.GetFileName(file.FileName);
        if (c.Media.Any(m => m.Id != target?.Id && string.Equals(m.FileName, incomingName, StringComparison.OrdinalIgnoreCase)))
            throw new ApiException(409, "Tên tệp đã tồn tại trong chiến dịch.");
        var media = target ?? new CampaignMedia { CampaignId = id, Kind = kind };
        media.FileName = Path.GetFileName(file.FileName)[..Math.Min(Path.GetFileName(file.FileName).Length, 200)];
        var root = Path.GetFullPath(configuration["CampaignUploads:Directory"] ?? Path.Combine(AppContext.BaseDirectory, "uploads", "campaigns"));
        Directory.CreateDirectory(root);
        var newPath = $"{Guid.NewGuid():N}.bin";
        var fullPath = Path.Combine(root, newPath);
        var oldPath = media.StoragePath;
        await File.WriteAllBytesAsync(fullPath, bytes, ct);
        try
        {
            media.ContentType = type; media.Content = []; media.StoragePath = newPath;
            if (target is null) c.Media.Add(media);
            c.UpdatedAt = DateTimeOffset.UtcNow; Audit(c, actor, target is null ? "UPLOAD" : "IMAGE_REPLACED", kind); await repository.Save(ct);
        }
        catch { File.Delete(fullPath); throw; }
        if (oldPath is not null && Path.GetFileName(oldPath) == oldPath)
        {
            try { File.Delete(Path.Combine(root, oldPath)); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
        return View(c);
    }
    public async Task<CampaignMedia> Download(Guid id, Guid mediaId, Guid? actor, CancellationToken ct)
    {
        var c = await Get(id, ct); var media = c.Media.SingleOrDefault(x => x.Id == mediaId) ?? throw new ApiException(404, "Không tìm thấy tệp.");
        if (c.Status != "PUBLISHED")
            await access.Require(c.OrganizationId, actor ?? throw new ApiException(401, "Vui lòng đăng nhập."), Readers, ct);
        if (media.StoragePath is not null)
        {
            if (Path.GetFileName(media.StoragePath) != media.StoragePath) throw new ApiException(404, "Không tìm thấy tệp.");
            var root = Path.GetFullPath(configuration["CampaignUploads:Directory"] ?? Path.Combine(AppContext.BaseDirectory, "uploads", "campaigns"));
            var path = Path.Combine(root, media.StoragePath);
            if (!File.Exists(path)) throw new ApiException(404, "Không tìm thấy tệp.");
            media.Content = await File.ReadAllBytesAsync(path, ct);
        }
        return media;
    }
}
