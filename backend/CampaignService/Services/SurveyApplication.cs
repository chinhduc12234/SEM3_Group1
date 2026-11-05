using CampaignService.Contracts;
using CampaignService.Data;
using CampaignService.Repositories;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace CampaignService.Services;

public sealed class SurveyApplication(SurveyRepository repository, OrganizationAccess access, SurveyImageProcessor images)
{
    private const int MaxSubmitAttempts = 3;
    private const string SubmissionNotificationPrefix = "Có báo cáo khảo sát mới cần xử lý:";
    private static void Match(SurveyReport r, string version)
    {
        if (string.IsNullOrEmpty(version) || Convert.ToBase64String(r.Version) != version)
            throw new ApiException(409, "Báo cáo đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
    private static void Editable(SurveyReport r)
    {
        if (r.Status is not ("DRAFT" or "NEEDS_REVISION")) throw new ApiException(409, "Chỉ được sửa hoặc xóa báo cáo nháp/cần bổ sung.");
    }
    private static void Apply(SurveyReport r, SurveyRequest request)
    {
        if (request.Title.Trim().Length < 3 || request.Province.Trim().Length < 2 || request.Ward.Trim().Length < 2
            || request.AddressDetail.Trim().Length < 5 || request.Description.Trim().Length < 30 || request.ProposedSupport.Trim().Length < 10)
            throw new ApiException(400, "Vui lòng nhập đầy đủ thông tin khảo sát.");
        if (request.SurveyedAt == default || request.SurveyedAt > DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).DateTime))
            throw new ApiException(400, "Ngày khảo sát không hợp lệ hoặc ở tương lai.");
        r.Title = request.Title.Trim(); r.Province = request.Province.Trim(); r.Ward = request.Ward.Trim();
        r.AddressDetail = request.AddressDetail.Trim(); r.Category = request.Category; r.Severity = request.Severity;
        r.AffectedHouseholds = request.AffectedHouseholds; r.Description = request.Description.Trim();
        r.ProposedSupport = request.ProposedSupport.Trim(); r.SurveyedAt = request.SurveyedAt;
        r.UpdatedAt = DateTimeOffset.UtcNow;
    }
    private static void Audit(SurveyReport r, Guid actor, string action, string note = "") => r.Events.Add(new()
        { ReportId = r.Id, ActorId = actor, Action = action, Note = note });
    private async Task<SurveyReport> Get(Guid id, CancellationToken ct) => await repository.Find(id, ct)
        ?? throw new ApiException(404, "Không tìm thấy báo cáo khảo sát.");
    private async Task Author(SurveyReport r, Guid actor, CancellationToken ct)
    {
        await access.Require(r.OrganizationId, actor, ["SURVEY_STAFF"], ct);
        if (r.StaffId != actor) throw new ApiException(403, "Chỉ được thay đổi báo cáo khảo sát của chính mình.");
    }
    private async Task Read(SurveyReport r, Guid actor, CancellationToken ct)
    {
        if (r.StaffId == actor) await Author(r, actor, ct);
        else
        {
            await access.Require(r.OrganizationId, actor, ["CAMPAIGN_MANAGER"], ct);
            if (r.ManagerId != actor || r.SubmittedAt is null || r.Status == "DRAFT")
                throw new ApiException(403, "Báo cáo chưa được gửi cho bạn xử lý.");
        }
    }
    private async Task<IQueryable<SurveyReport>> Scope(Guid org, Guid actor, string mode, CancellationToken ct)
    {
        if (mode is not ("mine" or "review")) throw new ApiException(400, "Chế độ xem không hợp lệ.");
        await access.Require(org, actor, mode == "mine" ? ["SURVEY_STAFF"] : ["CAMPAIGN_MANAGER"], ct);
        var q = repository.Query.AsNoTracking().Where(r => r.OrganizationId == org);
        return mode == "mine" ? q.Where(r => r.StaffId == actor)
            : q.Where(r => r.ManagerId == actor && r.SubmittedAt != null && r.Status != "DRAFT");
    }
    public async Task<object> Dashboard(Guid org, Guid actor, string mode, CancellationToken ct)
    {
        var q = await Scope(org, actor, mode, ct);
        var groups = await q.GroupBy(r => r.Status).Select(g => new { status = g.Key, count = g.Count() }).ToListAsync(ct);
        var unread = await repository.Notifications.CountAsync(n => n.RecipientId == actor && n.ReadAt == null
            && repository.Query.Any(r => r.Id == n.ReportId && r.OrganizationId == org
                && (r.StaffId == actor || r.ManagerId == actor)), ct);
        return new { total = groups.Sum(g => g.count), submitted = await q.CountAsync(r => r.SubmittedAt != null, ct),
            draft = groups.Where(g => g.status == "DRAFT").Sum(g => g.count),
            pending = groups.Where(g => g.status == "SUBMITTED").Sum(g => g.count),
            needsRevision = groups.Where(g => g.status == "NEEDS_REVISION").Sum(g => g.count),
            approved = groups.Where(g => g.status == "APPROVED").Sum(g => g.count),
            rejected = groups.Where(g => g.status == "REJECTED").Sum(g => g.count), unreadNotifications = unread };
    }
    public async Task<object> List(Guid org, Guid actor, string mode, string? status, int page, CancellationToken ct)
    {
        var q = await Scope(org, actor, mode, ct);
        if (!string.IsNullOrEmpty(status)) q = q.Where(r => r.Status == status);
        var totalCount = await q.CountAsync(ct);
        var items = await q.OrderByDescending(r => r.UpdatedAt).ThenBy(r => r.Id).Skip((page - 1) * 20).Take(20)
            .Select(r => new { r.Id, r.Title, r.Province, r.Ward, r.Category, r.Severity, r.Status, r.StaffId, r.ManagerId, r.CreatedAt, r.SubmittedAt, r.UpdatedAt }).ToListAsync(ct);
        return new { items, totalCount, page, pageSize = 20 };
    }
    public async Task<object> Detail(Guid id, Guid actor, CancellationToken ct)
    {
        var r = await Get(id, ct); await Read(r, actor, ct);
        var media = await repository.Images.AsNoTracking().Where(i => i.ReportId == id)
            .Select(i => new { i.Id, i.FileName, i.ContentType, i.FileSize, i.CreatedAt }).ToListAsync(ct);
        var events = await repository.Events.AsNoTracking().Where(e => e.ReportId == id).OrderBy(e => e.CreatedAt).ThenBy(e => e.Id)
            .Select(e => new { e.Action, e.Note, e.ActorId, e.CreatedAt }).ToListAsync(ct);
        return new { r.Id, r.OrganizationId, r.StaffId, r.ManagerId, r.Title, r.Province, r.Ward, r.AddressDetail,
            r.Category, r.Severity, r.AffectedHouseholds, r.Description, r.ProposedSupport, r.SurveyedAt, r.Status,
            r.ReviewNote, r.ReviewedBy, r.ReviewedAt, r.SubmittedAt, r.CreatedAt, r.UpdatedAt,
            version = Convert.ToBase64String(r.Version), images = media, history = events };
    }
    public async Task<Guid> Create(Guid org, SurveyRequest request, Guid actor, CancellationToken ct)
    {
        await access.Require(org, actor, ["SURVEY_STAFF"], ct);
        var r = new SurveyReport { OrganizationId = org, StaffId = actor };
        Apply(r, request); Audit(r, actor, "CREATE"); repository.Add(r); await repository.Save(ct); return r.Id;
    }
    public async Task Update(Guid id, SurveyRequest request, Guid actor, CancellationToken ct)
    {
        var r = await Get(id, ct); await Author(r, actor, ct); Match(r, request.Version); Editable(r);
        Apply(r, request); Audit(r, actor, "UPDATE"); await repository.Save(ct);
    }
    public async Task Delete(Guid id, string version, Guid actor, CancellationToken ct)
    {
        var r = await Get(id, ct); await Author(r, actor, ct); Match(r, version); Editable(r);
        r.IsDeleted = true; r.UpdatedAt = DateTimeOffset.UtcNow; Audit(r, actor, "DELETE"); await repository.Save(ct);
    }
    public async Task Submit(Guid id, string version, Guid actor, CancellationToken ct)
    {
        var r = await Get(id, ct); await Author(r, actor, ct); Match(r, version); Editable(r);
        var submitAttempts = await repository.Events.CountAsync(e => e.ReportId == id && e.Action == "SUBMIT", ct);
        if (submitAttempts >= MaxSubmitAttempts)
            throw new ApiException(409, "Báo cáo đã được gửi tối đa 3 lần. Hãy tạo báo cáo mới nếu cần xử lý lại.");
        var staff = await access.Require(r.OrganizationId, actor, ["SURVEY_STAFF"], ct);
        var manager = staff.SurveyManagerUserId ?? throw new ApiException(400, "Bạn chưa được gán Quản lý chiến dịch phụ trách. Hãy liên hệ Owner.");
        if (manager == actor) throw new ApiException(400, "Không gửi báo cáo cho chính mình.");
        await access.Require(r.OrganizationId, manager, ["CAMPAIGN_MANAGER"], ct);
        if (!await repository.Images.AnyAsync(i => i.ReportId == id, ct)) throw new ApiException(400, "Cần ít nhất một ảnh minh chứng trước khi gửi.");
        // The recipient is resolved server-side from Organization; the client cannot choose a reviewer.
        r.ManagerId = manager; r.Status = "SUBMITTED"; r.SubmittedAt = r.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(r, actor, "SUBMIT", $"Gửi Quản lý chiến dịch {manager}");
        await repository.RemoveNotifications(id, manager, SubmissionNotificationPrefix, ct);
        repository.Notify(new() { ReportId = id, RecipientId = manager, Message = "Có báo cáo khảo sát mới cần xử lý: " + r.Title });
        await repository.Save(ct);
    }
    public async Task Review(Guid id, SurveyReviewRequest request, Guid actor, CancellationToken ct)
    {
        var r = await Get(id, ct); await Read(r, actor, ct);
        await access.Require(r.OrganizationId, actor, ["CAMPAIGN_MANAGER"], ct);
        if (r.ManagerId != actor || r.StaffId == actor) throw new ApiException(403, "Chỉ Quản lý chiến dịch nhận báo cáo mới được xét duyệt.");
        Match(r, request.Version);
        if (r.Status != "SUBMITTED") throw new ApiException(409, "Báo cáo không ở trạng thái chờ duyệt.");
        if (request.Decision != "APPROVE" && string.IsNullOrWhiteSpace(request.Note)) throw new ApiException(400, "Cần nhập lý do từ chối hoặc yêu cầu bổ sung.");
        r.Status = request.Decision switch { "APPROVE" => "APPROVED", "REQUEST_CHANGES" => "NEEDS_REVISION", "REJECT" => "REJECTED", _ => throw new ApiException(400, "Quyết định không hợp lệ.") };
        r.ReviewNote = request.Note.Trim(); r.ReviewedBy = actor; r.ReviewedAt = r.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(r, actor, request.Decision, r.ReviewNote);
        var result = r.Status == "APPROVED" ? "được chấp nhận" : r.Status == "REJECTED" ? "bị từ chối" : "cần bổ sung";
        repository.Notify(new() { ReportId = id, RecipientId = r.StaffId, Message = $"Báo cáo {r.Title} {result}. {r.ReviewNote}" });
        await repository.Save(ct);
    }
    public async Task Upload(Guid id, string version, List<IFormFile> files, Guid actor, CancellationToken ct)
    {
        var r = await Get(id, ct); await Author(r, actor, ct); Match(r, version); Editable(r);
        if (files.Count == 0 || files.Count > 10 || files.Count + await repository.Images.CountAsync(i => i.ReportId == id, ct) > 10)
            throw new ApiException(400, "Mỗi báo cáo có tối đa 10 ảnh. Vui lòng chọn ít nhất một ảnh.");
        // Validate the whole batch before tracking any inserts, so a bad file never partially uploads a batch.
        var prepared = new List<SurveyReportImage>();
        foreach (var file in files)
        {
            var content = await images.Process(file, ct);
            var image = new SurveyReportImage { ReportId = id, Content = content, FileSize = content.LongLength, UploadedBy = actor };
            image.FileName = image.Id.ToString("N") + ".jpg";
            image.FileReference = $"survey/{id}/{image.Id}";
            prepared.Add(image);
        }
        r.Images.AddRange(prepared); r.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(r, actor, "IMAGES_ADDED", $"{prepared.Count} ảnh minh chứng"); await repository.Save(ct);
    }
    public async Task RemoveImage(Guid id, Guid imageId, string version, Guid actor, CancellationToken ct)
    {
        var r = await Get(id, ct); await Author(r, actor, ct); Match(r, version); Editable(r);
        var image = await repository.Images.SingleOrDefaultAsync(i => i.Id == imageId && i.ReportId == id, ct)
            ?? throw new ApiException(404, "Không tìm thấy ảnh.");
        repository.RemoveImage(image); r.UpdatedAt = DateTimeOffset.UtcNow;
        Audit(r, actor, "IMAGE_REMOVED", imageId.ToString()); await repository.Save(ct);
    }
    public async Task<SurveyReportImage> Image(Guid id, Guid imageId, Guid actor, CancellationToken ct)
    {
        var r = await Get(id, ct); await Read(r, actor, ct);
        return await repository.Images.AsNoTracking().SingleOrDefaultAsync(i => i.Id == imageId && i.ReportId == id, ct)
            ?? throw new ApiException(404, "Không tìm thấy ảnh.");
    }
    public async Task<object> Notifications(Guid org, Guid actor, int page, CancellationToken ct)
    {
        await access.Require(org, actor, ["SURVEY_STAFF", "CAMPAIGN_MANAGER"], ct);
        var q = from n in repository.Notifications.AsNoTracking()
                join r in repository.Query.AsNoTracking() on n.ReportId equals r.Id
                where n.RecipientId == actor && r.OrganizationId == org
                    && (r.StaffId == actor || r.ManagerId == actor)
                select new { Notification = n, Report = r };
        var totalCount = await q.CountAsync(ct);
        var items = await q.OrderByDescending(x => x.Notification.CreatedAt).ThenBy(x => x.Notification.Id).Skip((page - 1) * 20).Take(20)
            .Select(x => new { x.Notification.Id, x.Notification.ReportId, x.Notification.Message,
                x.Notification.CreatedAt, x.Notification.ReadAt, reportTitle = x.Report.Title,
                reportStatus = x.Report.Status, x.Report.ReviewNote, x.Report.ReviewedAt }).ToListAsync(ct);
        return new { items, totalCount, page, pageSize = 20 };
    }
    public async Task ReadNotification(Guid notificationId, Guid actor, CancellationToken ct)
    {
        var n = await repository.Notifications.SingleOrDefaultAsync(n => n.Id == notificationId && n.RecipientId == actor, ct)
            ?? throw new ApiException(404, "Không tìm thấy thông báo.");
        var r = await Get(n.ReportId, ct); await Read(r, actor, ct);
        n.ReadAt ??= DateTimeOffset.UtcNow; await repository.Save(ct);
    }
}
