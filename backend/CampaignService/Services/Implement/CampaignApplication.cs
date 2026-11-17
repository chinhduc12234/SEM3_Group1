using CampaignService.Contracts;
using CampaignService.Data;
using CampaignService.Repositories;
using Microsoft.EntityFrameworkCore;
using Shared;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace CampaignService.Services;

public sealed partial class CampaignApplication(ICampaignRepository repository, IOrganizationAccess access, IConfiguration configuration, CampaignDb db) : ICampaignApplication
{
    private static readonly string[] Managers = ["CAMPAIGN_MANAGER"];
    private static readonly string[] Readers = ["CAMPAIGN_MANAGER", "OWNER", "VOLUNTEER_COORDINATOR", "FINANCE_MANAGER"];
    private static readonly string[] CreatorVisibleStatuses =
        ["DRAFT", "NEEDS_REVISION", "PENDING_CONCEPT_APPROVAL", "PENDING_REVIEW", "CONCEPT_APPROVED", "REJECTED"];
    private static readonly JsonSerializerOptions SnapshotJson = new(JsonSerializerDefaults.Web);
    public static CampaignView View(Campaign c, bool history = true) => new(c.Id, c.OrganizationId, c.CreatedBy,
        c.Title, c.Description, c.CampaignType, c.Cause, c.BeneficiaryDescription, c.GoalAmount, c.VolunteerTarget,
        c.StartDate, c.EndDate, c.Location, c.ContactEmail, c.ContactPhone, c.Status, Convert.ToBase64String(c.Version),
        c.CreatedAt, c.SubmittedAt, c.PublishedAt,
        c.Media.Where(m => history || m.Kind is "COVER" or "GALLERY").Select(m => (object)new { m.Id, m.Kind, m.FileName, m.ContentType }).ToArray(),
        history ? c.Reviews.OrderBy(x => x.CreatedAt).Select(r => (object)new { r.Id, r.Action, r.Note, r.ActorId, r.CreatedAt }).ToArray() : [],
        !history && c.ConceptDetails is not null ? "{}" : c.AdditionalDetails,
        history ? ReadConcept(c) : null, history ? c.ParentCampaign?.Title : null,
        history ? c.Assignments.Where(a => a.RevokedAt == null).Select(a =>
            new CampaignAssignmentView(a.UserId, a.FullName, a.Role, a.IsPrimary)).ToArray() : [],
        history ? c.OperationsConfirmedAt : null, history ? c.BudgetConfirmedAt : null, history && c.BudgetNeedsReview,
        history ? FinalSubmission(c)?.Id : null, ReadPublicPlan(c));
    public static void Match(Campaign c, string version)
    {
        if (string.IsNullOrEmpty(version) || Convert.ToBase64String(c.Version) != version) throw new ApiException(409, "Chiến dịch đã thay đổi. Vui lòng tải lại.");
    }
    private static CampaignConcept? ReadConcept(Campaign c) => c.ConceptDetails is null
        ? null
        : JsonSerializer.Deserialize<CampaignConcept>(c.ConceptDetails, SnapshotJson);

    private static void RequireManagerScope(Campaign c, Guid actor)
    {
        if (c.CreatedBy != actor && (c.ConceptDetails is not null || c.Status != "PUBLISHED"))
            throw new ApiException(403, "Bạn không phụ trách hồ sơ này.");
    }

    private IQueryable<Campaign> ParentCampaigns(Guid organizationId) =>
        repository.Query.Where(c => c.OrganizationId == organizationId &&
            (c.CampaignType == "CAMPAIGN" || c.CampaignType == "COMBINED") &&
            (c.Status == "CONCEPT_APPROVED" || c.Status == "PLANNING" || c.Status == FinalPending ||
                c.Status == FinalApproved || c.Status == "PUBLISHED"));

    public async Task<object> ParentOptions(Guid organizationId, Guid actor, CancellationToken ct)
    {
        await access.Require(organizationId, actor, Managers, ct);
        return await ParentCampaigns(organizationId).AsNoTracking()
            .OrderBy(c => c.Title).Select(c => new { c.Id, c.Title }).ToListAsync(ct);
    }

    private async Task ApplyConcept(Campaign c, CampaignRequest r, CancellationToken ct)
    {
        if (r.Concept is not { } concept || r.CampaignType is not ("CAMPAIGN" or "EVENT"))
            throw new ApiException(400, "Chọn loại chiến dịch hoặc sự kiện và nhập thông tin đề xuất.");
        if (r.GoalAmount != 0 || r.VolunteerTarget != 0)
            throw new ApiException(400, "Dự toán và chỉ tiêu tình nguyện được lập sau khi ý tưởng được duyệt.");
        if (r.StartDate == DateOnly.MinValue || r.EndDate == DateOnly.MinValue || r.EndDate < r.StartDate)
            throw new ApiException(400, "Khoảng thời gian dự kiến không hợp lệ.");
        if (string.IsNullOrWhiteSpace(concept.Timezone) || !TimeZoneInfo.TryFindSystemTimeZoneById(concept.Timezone, out _))
            throw new ApiException(400, "Múi giờ của chương trình không hợp lệ.");
        if (r.CampaignType == "CAMPAIGN" && (concept.ParentCampaignId.HasValue || concept.EventFormat is not null ||
            !string.IsNullOrWhiteSpace(concept.OnlinePlatform) || concept.EventStartTime.HasValue || concept.EventEndTime.HasValue))
            throw new ApiException(400, "Các thông tin sự kiện chỉ áp dụng cho hồ sơ loại sự kiện.");
        var platform = concept.OnlinePlatform?.Trim();
        if (!string.IsNullOrEmpty(platform) && concept.EventFormat is not ("ONLINE" or "HYBRID"))
            throw new ApiException(400, "Nền tảng chỉ áp dụng cho sự kiện trực tuyến hoặc kết hợp.");
        if (concept.EventStartTime is TimeOnly start && concept.EventEndTime is TimeOnly end &&
            !(r.StartDate.HasValue && r.EndDate > r.StartDate) && end <= start)
            throw new ApiException(400, "Giờ kết thúc phải sau giờ bắt đầu. Nếu sự kiện qua đêm, hãy nhập cả hai ngày.");
        var address = concept.PlannedAddress;
        if (address is not null && (concept.EventFormat == "ONLINE" ||
            (address.Province is null && (address.District is not null || address.Ward is not null)) ||
            (address.Mode == "CURRENT" && address.District is not null) ||
            (address.Mode == "LEGACY" && address.Ward is not null && address.District is null)))
            throw new ApiException(400, "Các cấp địa chỉ dự kiến không phù hợp.");
        var location = address is null ? r.Location.Trim() : string.Join(", ",
            new[] { address.Detail, address.Ward?.Name, address.District?.Name, address.Province?.Name }
                .Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!.Trim()));
        if (location.Length > 400) throw new ApiException(400, "Địa chỉ dự kiến có tối đa 400 ký tự.");
        Campaign? parent = null;
        if (concept.ParentCampaignId is Guid parentId)
        {
            parent = await ParentCampaigns(c.OrganizationId).SingleOrDefaultAsync(x => x.Id == parentId, ct);
            if (parent is null) throw new ApiException(400, "Chiến dịch cha phải thuộc tổ chức và đã được duyệt ý tưởng.");
        }

        c.Title = r.Title.Trim();
        c.Description = r.Description.Trim();
        c.CampaignType = r.CampaignType;
        c.Cause = r.Cause;
        c.BeneficiaryDescription = r.BeneficiaryDescription.Trim();
        c.StartDate = r.StartDate;
        c.EndDate = r.EndDate;
        c.Location = concept.EventFormat == "ONLINE" ? "" : location;
        c.ContactEmail = r.ContactEmail ?? "";
        c.ContactPhone = r.ContactPhone.Trim();
        c.ParentCampaign = parent;
        c.ParentCampaignId = parent?.Id;
        c.ConceptDetails = JsonSerializer.Serialize(concept with { OnlinePlatform = platform }, SnapshotJson);
        c.UpdatedAt = DateTimeOffset.UtcNow;
    }
    private static void Audit(Campaign c, Guid actor, string action, string note = "", string? snapshot = null) =>
        c.Reviews.Add(new() { CampaignId = c.Id, ActorId = actor, Action = action, Note = note, SubmittedSnapshot = snapshot });
    public async Task<Campaign> Get(Guid id, CancellationToken ct) => await repository.Find(id, ct) ?? throw new ApiException(404, "Không tìm thấy chiến dịch.");
    public async Task<CampaignView> Create(CampaignRequest r, Guid actor, CancellationToken ct)
    {
        if (r.OrganizationId == Guid.Empty) throw new ApiException(400, "Thiếu tổ chức sở hữu hồ sơ.");
        await access.Require(r.OrganizationId, actor, Managers, ct);
        var c = new Campaign { OrganizationId = r.OrganizationId, CreatedBy = actor };
        await ApplyConcept(c, r, ct);
        Audit(c, actor, "CREATE"); repository.Add(c); await repository.Save(ct); return View(c);
    }
    public async Task<CampaignView> Update(Guid id, CampaignRequest r, Guid actor, CancellationToken ct)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, Managers, ct); RequireManagerScope(c, actor); Match(c, r.Version);
        if (c.OrganizationId != r.OrganizationId) throw new ApiException(400, "Không được chuyển tổ chức sở hữu.");
        if (c.Status == "PUBLISHED")
        {
            if (FinalSubmission(c) is not null)
                throw new ApiException(409, "Nội dung đã công bố theo phiên bản được duyệt cuối.");
            if (r.Title.Trim().Length < 3 || r.Description.Trim().Length < 30)
                throw new ApiException(400, "Vui lòng nhập tên và mô tả chiến dịch hợp lệ.");
            if (c.CampaignType != r.CampaignType || c.Cause != r.Cause || c.BeneficiaryDescription != r.BeneficiaryDescription.Trim()
                || c.GoalAmount != r.GoalAmount || c.VolunteerTarget != r.VolunteerTarget || c.StartDate != r.StartDate || c.EndDate != r.EndDate
                || c.Location != r.Location.Trim() || c.ContactEmail != (r.ContactEmail?.Trim() ?? "") || c.ContactPhone != r.ContactPhone.Trim())
                throw new ApiException(400, "Sau khi duyệt chỉ được sửa tên và mô tả. Thông tin liên hệ, mục tiêu và phạm vi chiến dịch đã khóa.");
            c.Title = r.Title.Trim(); c.Description = r.Description.Trim(); c.UpdatedAt = DateTimeOffset.UtcNow;
            Audit(c, actor, "CONTENT_UPDATED"); await repository.Save(ct); return View(c);
        }
        if (c.Status is not ("DRAFT" or "NEEDS_REVISION"))
            throw new ApiException(409, "Chỉ được sửa bản nháp hoặc hồ sơ được yêu cầu chỉnh sửa.");
        await ApplyConcept(c, r, ct);
        Audit(c, actor, "UPDATE");
        await repository.Save(ct); return View(c);
    }
    public async Task Delete(Guid id, string version, Guid actor, CancellationToken ct)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, Managers, ct); RequireManagerScope(c, actor); Match(c, version);
        if (c.Status != "DRAFT" || c.SubmittedAt.HasValue)
            throw new ApiException(409, "Chỉ có thể xóa bản nháp chưa gửi duyệt.");
        var paths = c.Media.Select(m => m.StoragePath).ToArray();
        repository.Remove(c);
        await repository.Save(ct);
        foreach (var path in paths) RemoveUpload(path);
    }
    public async Task<CampaignView> Submit(Guid id, string version, Guid actor, CancellationToken ct)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, Managers, ct); RequireManagerScope(c, actor); Match(c, version);
        if (c.Status is not ("DRAFT" or "NEEDS_REVISION")) throw new ApiException(409, "Trạng thái không cho phép gửi duyệt.");
        var concept = ReadConcept(c);
        if (concept is null || c.Title.Length < 3 || (c.CampaignType == "CAMPAIGN" && string.IsNullOrWhiteSpace(c.Location)) ||
            new[] { c.Cause, c.Description, c.BeneficiaryDescription,
                concept.ShortDescription, concept.PrimaryGoal, concept.Mission, concept.PlannedScale }
                .Any(string.IsNullOrWhiteSpace))
            throw new ApiException(400, "Vui lòng hoàn thành các mục bắt buộc trước khi gửi duyệt ý tưởng.");
        if (concept.PlannedAddress is { } address && (address.Province is null || address.Ward is null))
            throw new ApiException(400, "Chọn đầy đủ tỉnh/thành và phường/xã cho địa chỉ dự kiến trước khi gửi duyệt.");
        if (concept.ParentCampaignId is Guid parent && !await ParentCampaigns(c.OrganizationId).AnyAsync(x => x.Id == parent, ct))
            throw new ApiException(400, "Chiến dịch cha không còn hợp lệ.");
        c.Status = "PENDING_CONCEPT_APPROVAL";
        c.SubmittedAt = c.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(c, actor, "SUBMIT", snapshot: CaptureConcept(c));
        await repository.Save(ct); return View(c);
    }
    public async Task<CampaignView> Review(Guid id, ReviewRequest r, Guid actor, CancellationToken ct)
    {
        var c = await Get(id, ct); await access.Require(c.OrganizationId, actor, ["OWNER"], ct); Match(c, r.Version);
        if (c.CreatedBy == actor) throw new ApiException(403, "Người tạo không được tự duyệt chiến dịch.");
        if (c.Status is not ("PENDING_REVIEW" or "PENDING_CONCEPT_APPROVAL")) throw new ApiException(409, "Chiến dịch chưa ở trạng thái chờ duyệt.");
        if (r.Decision != "APPROVE" && string.IsNullOrWhiteSpace(r.Note)) throw new ApiException(400, "Vui lòng nhập lý do yêu cầu sửa hoặc từ chối.");
        if (c.Status == "PENDING_REVIEW")
        {
            var submission = c.Reviews.OrderByDescending(x => x.CreatedAt).FirstOrDefault(x => x.Action is "SUBMIT" or "SUBMISSION_UPDATED");
            if (submission is not null) submission.SubmittedSnapshot ??= CaptureConcept(c);
        }
        c.Status = r.Decision switch { "APPROVE" => "CONCEPT_APPROVED", "REQUEST_CHANGES" => "NEEDS_REVISION", "REJECT" => "REJECTED", _ => throw new ApiException(400, "Quyết định không hợp lệ.") };
        c.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(c, actor, r.Decision, r.Note?.Trim() ?? ""); await repository.Save(ct); return View(c);
    }
    private static string CaptureConcept(Campaign c) => JsonSerializer.Serialize(new
    {
        c.Title, c.Description, c.CampaignType, c.Cause, c.BeneficiaryDescription, c.StartDate,
        c.EndDate, c.Location, ParentCampaignTitle = c.ParentCampaign?.Title, Concept = ReadConcept(c),
        LegacyDetails = c.ConceptDetails is null ? c.AdditionalDetails : null,
        Media = c.Media.Select(m => new { m.Id, m.Kind, m.FileName, m.ContentType })
    }, SnapshotJson);
    public async Task<object> List(Guid? org, Guid? actor, int page, string? search, string? cause, CancellationToken ct, int pageSize = 20, string? status = null, bool assigned = false, string? assignedRole = null, string? campaignType = null)
    {
        var query = repository.Query.AsNoTracking();
        Guid? membershipId = null;
        string[] roles = [];
        if (org.HasValue)
        {
            var permission = await access.Require(org.Value, actor!.Value, Readers, ct);
            query = query.Where(x => x.OrganizationId == org.Value);
            membershipId = permission.MembershipId;
            roles = permission.Roles;
            if (!roles.Contains("OWNER"))
                query = ReadableCampaigns(query, actor!.Value, permission);
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
            if (campaignType is not null)
                query = query.Where(x => x.CampaignType == campaignType ||
                    (campaignType == "CAMPAIGN" && x.CampaignType == "COMBINED"));
            if (assignedRole is not null && !roles.Contains(assignedRole))
                throw new ApiException(403, "Bạn không có vai trò được yêu cầu trong tổ chức.");
            if (assigned || assignedRole is not null) query = query.Where(x => x.Assignments.Any(a =>
                a.UserId == actor && a.MembershipId == membershipId && a.RevokedAt == null && roles.Contains(a.Role) &&
                (assignedRole == null || a.Role == assignedRole)));
        }
        else query = query.Where(x => x.Status == "PUBLISHED");
        if (!string.IsNullOrWhiteSpace(search))
            query = org.HasValue
                ? query.Where(x => x.Title.Contains(search) || x.Description.Contains(search) || x.Location.Contains(search))
                : query.Where(x => x.Title.Contains(search));
        if (!string.IsNullOrWhiteSpace(cause)) query = query.Where(x => x.Cause == cause);
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100); var count = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { x.Id, x.OrganizationId, x.Title, x.Description, x.CampaignType, x.Cause, x.GoalAmount, x.VolunteerTarget, x.StartDate, x.EndDate, x.Location, x.Status,
                createdBy = org.HasValue ? (Guid?)x.CreatedBy : null,
                operationsConfirmedAt = org.HasValue ? x.OperationsConfirmedAt : null,
                budgetConfirmedAt = org.HasValue ? x.BudgetConfirmedAt : null,
                budgetNeedsReview = org.HasValue && x.BudgetNeedsReview,
                legacyPublished = org.HasValue && x.Status == "PUBLISHED" && x.ConceptDetails == null,
                isAssigned = actor.HasValue && x.Assignments.Any(a => a.UserId == actor && a.MembershipId == membershipId && a.RevokedAt == null && roles.Contains(a.Role)),
                coverMediaId = x.Media.Where(m => m.Kind == "COVER").Select(m => (Guid?)m.Id).FirstOrDefault() }).ToListAsync(ct);
        return new { items = rows, totalCount = count, page, pageSize };
    }
    public async Task<CampaignView> Detail(Guid id, Guid? actor, bool management, CancellationToken ct)
    {
        var c = await Get(id, ct);
        if (management) await RequireRead(c, actor, ct);
        else if (c.Status != "PUBLISHED") throw new ApiException(404, "Không tìm thấy chiến dịch công khai.");
        var view = View(c, management);
        if (management || view.PublicPlan is not { Days.Length: > 0 } plan) return view;
        return view with { StartDate = plan.Days[0].Date, EndDate = plan.Days[^1].Date,
            Location = plan.EventFormat == "ONLINE" ? "Trực tuyến" : view.Location };
    }

    public async Task<object> RelatedCampaigns(Guid id, Guid actor, CancellationToken ct)
    {
        var campaign = await Get(id, ct);
        var permission = await RequireRead(campaign, actor, ct);
        var roles = permission.Roles;
        var query = repository.Query.AsNoTracking().Where(candidate => candidate.OrganizationId == campaign.OrganizationId &&
            (candidate.Id == campaign.ParentCampaignId || candidate.ParentCampaignId == id));
        if (!roles.Contains("OWNER"))
            query = ReadableCampaigns(query, actor, permission);
        var records = await query.OrderBy(candidate => candidate.StartDate).ThenBy(candidate => candidate.Title)
            .Select(candidate => new { candidate.Id, candidate.Title, candidate.Status, candidate.StartDate }).ToListAsync(ct);
        return new
        {
            parent = records.FirstOrDefault(candidate => candidate.Id == campaign.ParentCampaignId),
            children = records.Where(candidate => candidate.Id != campaign.ParentCampaignId)
        };
    }
    public async Task<CampaignView> Upload(Guid id, string version, string kind, IFormFile file, Guid actor, CancellationToken ct, Guid? replaceId = null)
    {
        var c = await Get(id, ct);
        var qr = kind == ReceivingQrKind;
        if (qr)
        {
            var permission = await RequireRead(c, actor, ct);
            if (!HasAssignment(c, actor, permission, FinanceRole))
                throw new ApiException(403, "Chỉ quản lý ngân sách được phân công có thể tải mã QR.");
            EnsurePlanning(c);
        }
        else
        {
            await access.Require(c.OrganizationId, actor, Managers, ct);
            RequireManagerScope(c, actor);
            if (c.Status is not ("DRAFT" or "NEEDS_REVISION" or "PUBLISHED") || FinalSubmission(c) is not null)
                throw new ApiException(409, "Không thể sửa ảnh ở trạng thái hiện tại.");
            if (c.Status == "PUBLISHED" && kind == "DOCUMENT") throw new ApiException(400, "Tài liệu hỗ trợ đã khóa sau khi duyệt.");
        }
        Match(c, version);
        var target = replaceId.HasValue
            ? c.Media.SingleOrDefault(m => m.Id == replaceId.Value && m.Kind == kind) ?? throw new ApiException(404, "Không tìm thấy ảnh cần thay.")
            : kind == "COVER" || qr ? c.Media.SingleOrDefault(m => m.Kind == kind) : null;
        var maxBytes = kind == "DOCUMENT" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        if ((!qr && kind is not ("COVER" or "GALLERY" or "DOCUMENT")) || file.Length < 8 || file.Length > maxBytes ||
            (!qr && target is null && c.Media.Count(m => m.Kind != ReceivingQrKind) >= 13))
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
        if (!qr && c.Media.Any(m => m.Kind != ReceivingQrKind && m.Id != target?.Id && string.Equals(m.FileName, incomingName, StringComparison.OrdinalIgnoreCase)))
            throw new ApiException(409, "Tên tệp đã tồn tại trong chiến dịch.");
        var media = target ?? new CampaignMedia { CampaignId = id, Kind = kind };
        media.FileName = Path.GetFileName(file.FileName)[..Math.Min(Path.GetFileName(file.FileName).Length, 200)];
        var root = UploadRoot();
        Directory.CreateDirectory(root);
        var newPath = $"{Guid.NewGuid():N}.bin";
        var fullPath = Path.Combine(root, newPath);
        var oldPath = media.StoragePath;
        await File.WriteAllBytesAsync(fullPath, bytes, ct);
        try
        {
            media.ContentType = type; media.Content = []; media.StoragePath = newPath;
            if (target is null) c.Media.Add(media);
            if (qr) c.BudgetConfirmedAt = null;
            c.UpdatedAt = DateTimeOffset.UtcNow;
            Audit(c, actor, qr ? "UPDATE_RECEIVING_QR" : target is null ? "UPLOAD" : "IMAGE_REPLACED", kind);
            await repository.Save(ct);
        }
        catch { File.Delete(fullPath); throw; }
        RemoveUpload(oldPath);
        return View(c);
    }
    public async Task<CampaignMedia> Download(Guid id, Guid mediaId, Guid? actor, CancellationToken ct)
    {
        var c = await Get(id, ct); var media = c.Media.SingleOrDefault(x => x.Id == mediaId) ?? throw new ApiException(404, "Không tìm thấy tệp.");
        if (c.Status != "PUBLISHED" || media.Kind is not ("COVER" or "GALLERY"))
            await RequireRead(c, actor, ct);
        if (media.StoragePath is not null)
        {
            if (Path.GetFileName(media.StoragePath) != media.StoragePath) throw new ApiException(404, "Không tìm thấy tệp.");
            var path = Path.Combine(UploadRoot(), media.StoragePath);
            if (!File.Exists(path)) throw new ApiException(404, "Không tìm thấy tệp.");
            media.Content = await File.ReadAllBytesAsync(path, ct);
        }
        return media;
    }

    private string UploadRoot() => Path.GetFullPath(
        configuration["CampaignUploads:Directory"] ?? Path.Combine(AppContext.BaseDirectory, "uploads", "campaigns"));

    private void RemoveUpload(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || Path.GetFileName(path) != path) return;
        try { File.Delete(Path.Combine(UploadRoot(), path)); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
    private async Task<OrganizationPermission> RequireRead(Campaign c, Guid? actor, CancellationToken ct)
    {
        var user = actor ?? throw new ApiException(401, "Vui lòng đăng nhập.");
        var permission = await access.Require(c.OrganizationId, user, Readers, ct);
        if (permission.Roles.Contains("OWNER") || HasAssignment(c, user, permission) ||
            (permission.Roles.Contains("CAMPAIGN_MANAGER") &&
                ((c.Status == "PUBLISHED" && c.ConceptDetails is null) ||
                    (c.CreatedBy == user && CreatorVisibleStatuses.Contains(c.Status)))))
            return permission;
        throw new ApiException(403, "Bạn không được phân công vào hồ sơ này.");
    }

    private static IQueryable<Campaign> ReadableCampaigns(IQueryable<Campaign> query, Guid actor, OrganizationPermission permission)
    {
        var roles = permission.Roles;
        var membershipId = permission.MembershipId;
        return query.Where(campaign =>
            (roles.Contains("CAMPAIGN_MANAGER") &&
                ((campaign.Status == "PUBLISHED" && campaign.ConceptDetails == null) ||
                    (campaign.CreatedBy == actor && CreatorVisibleStatuses.Contains(campaign.Status)))) ||
            campaign.Assignments.Any(assignment => assignment.UserId == actor && assignment.MembershipId == membershipId &&
                assignment.RevokedAt == null && roles.Contains(assignment.Role)));
    }
}
