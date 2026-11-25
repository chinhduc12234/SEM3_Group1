using Shared;
using VolunteerService.Contracts;
using VolunteerService.Data;
using VolunteerService.Repositories;

namespace VolunteerService.Services;

public sealed class VolunteerTaskService(IVolunteerTaskRepository repository,
    ICampaignTaskAccessClient campaignAccess, IVolunteerRegistrationRepository registrations, VolunteerDb db) : IVolunteerTaskService
{
    public async Task<VolunteerTaskView[]> List(Guid userId, Guid campaignId, Guid activityId,
        Guid groupId, CancellationToken ct)
    {
        ValidateIds(userId, campaignId, activityId, groupId);
        await RequireTeamLead(userId, campaignId, activityId, groupId, ct);
        return (await repository.List(campaignId, activityId, groupId, ct)).Select(ToView).ToArray();
    }

    public async Task<VolunteerTaskView> Get(Guid userId, Guid taskId, CancellationToken ct)
    {
        ValidateIds(userId, taskId);
        var task = await repository.Find(taskId, ct) ?? throw new ApiException(404, "Không tìm thấy task.");
        await RequireTeamLead(userId, task.CampaignId, task.ActivityId, task.GroupId, ct);
        return ToView(task);
    }

    public async Task<VolunteerTaskCandidate[]> Candidates(Guid userId, Guid campaignId, Guid activityId, Guid groupId, CancellationToken ct)
    {
        await RequireTeamLead(userId, campaignId, activityId, groupId, ct);
        return (await repository.ActiveGroupRegistrations(campaignId, groupId, null, ct))
            .Select(item => new VolunteerTaskCandidate(item.Id, item.FullName)).ToArray();
    }

    public async Task<VolunteerTaskView> Create(Guid userId, CreateVolunteerTaskRequest request, CancellationToken ct)
    {
        var campaignId = request.CampaignId;
        var activityId = request.ActivityId;
        var groupId = request.GroupId;
        ValidateIds(userId, campaignId, activityId, groupId);
        var access = await RequireTeamLead(userId, campaignId, activityId, groupId, ct);
        ValidateRequest(request, access);
        if (request.RequiredVolunteers > access.GroupTarget)
            throw new ApiException(400, "Số người cần cho task không được vượt chỉ tiêu của nhóm trong kế hoạch vận hành.");

        var now = DateTimeOffset.UtcNow;
        var task = new VolunteerTask
        {
            CampaignId = campaignId,
            ActivityId = activityId,
            GroupId = groupId,
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            RequiredVolunteers = request.RequiredVolunteers,
            Priority = request.Priority.Trim().ToUpperInvariant(),
            Status = "OPEN",
            Note = Normalize(request.Note),
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now
        };
        repository.Add(task);
        await repository.Save(ct);
        return ToView(task);
    }

    public async Task<VolunteerTaskView> Update(Guid userId, Guid taskId,
        UpdateVolunteerTaskRequest request, CancellationToken ct)
    {
        ValidateIds(userId, taskId);
        var task = await repository.Find(taskId, ct) ?? throw new ApiException(404, "Không tìm thấy task.");
        var access = await RequireTeamLead(userId, task.CampaignId, task.ActivityId, task.GroupId, ct);
        if (task.Status is "CANCELLED" or "COMPLETED")
            throw new ApiException(409, "Task đã hủy hoặc hoàn thành nên không thể sửa.");
        ValidateRequest(request, access);
        var assignments = await repository.AssignmentsForTask(taskId, ct);
        var activeAssignments = assignments.Count(IsActiveAssignment);
        if (request.RequiredVolunteers < activeAssignments)
            throw new ApiException(409, "Số người cần không thể thấp hơn số volunteer đang được giao task.");
        if (request.RequiredVolunteers > access.GroupTarget)
            throw new ApiException(400, "Số người cần cho task không được vượt chỉ tiêu của nhóm trong kế hoạch vận hành.");

        task.Name = request.Name.Trim();
        task.Description = request.Description.Trim();
        task.StartTime = request.StartTime;
        task.EndTime = request.EndTime;
        task.RequiredVolunteers = request.RequiredVolunteers;
        task.Priority = request.Priority.Trim().ToUpperInvariant();
        task.Note = Normalize(request.Note);
        task.UpdatedAt = DateTimeOffset.UtcNow;
        await repository.Save(ct);
        return ToView(task);
    }

    public async Task Cancel(Guid userId, Guid taskId, CancellationToken ct)
    {
        ValidateIds(userId, taskId);
        var task = await repository.Find(taskId, ct) ?? throw new ApiException(404, "Không tìm thấy task.");
        await RequireTeamLead(userId, task.CampaignId, task.ActivityId, task.GroupId, ct);
        if (task.Status == "COMPLETED")
            throw new ApiException(409, "Task đã hoàn thành nên không thể hủy.");
        if (task.Status != "CANCELLED")
        {
            var assignments = await repository.AssignmentsForTask(taskId, ct);
            var now = DateTimeOffset.UtcNow;
            foreach (var assignment in assignments.Where(IsActiveAssignment))
            {
                assignment.Status = "CANCELLED";
                assignment.UpdatedAt = now;
            }
            task.Status = "CANCELLED";
            task.UpdatedAt = now;
            await repository.Save(ct);
        }
    }

    public async Task<VolunteerTaskView> Assign(Guid userId, Guid taskId,
        AssignVolunteersToTaskRequest request, CancellationToken ct)
    {
        ValidateIds(userId, taskId);
        var task = await repository.Find(taskId, ct) ?? throw new ApiException(404, "Không tìm thấy task.");
        await RequireTeamLead(userId, task.CampaignId, task.ActivityId, task.GroupId, ct);
        await using var gate = await registrations.LockCampaign(task.CampaignId, ct);
        db.ChangeTracker.Clear();
        task = await repository.Find(taskId, ct) ?? throw new ApiException(404, "Không tìm thấy task.");
        if (task.Status is "DRAFT" or "CANCELLED" or "COMPLETED")
            throw new ApiException(409, "Task hiện không nhận phân công volunteer.");
        var registrationIds = request.RegistrationIds ?? [];
        if (registrationIds.Length == 0 || registrationIds.Length > 100 ||
            registrationIds.Any(id => id == Guid.Empty) || registrationIds.Distinct().Count() != registrationIds.Length)
            throw new ApiException(400, "Danh sách hồ sơ tình nguyện viên bị rỗng, quá dài hoặc có ID trùng.");

        var eligible = await repository.ActiveGroupRegistrations(task.CampaignId, task.GroupId, registrationIds, ct);
        if (eligible.Length != registrationIds.Length)
            throw new ApiException(400, "Chỉ được giao việc cho tình nguyện viên đã xác nhận ca trong đúng nhóm.");

        var existing = await repository.AssignmentsForTask(taskId, ct);
        var byRegistration = existing.ToDictionary(item => item.RegistrationId);
        var toActivate = registrationIds.Where(id => !byRegistration.TryGetValue(id, out var item) ||
            item.Status is "CANCELLED" or "DECLINED").ToArray();
        var activeCount = existing.Count(IsActiveAssignment);
        if (activeCount + toActivate.Length > task.RequiredVolunteers)
            throw new ApiException(409, "Số volunteer được giao sẽ vượt số người cần cho task.");

        var now = DateTimeOffset.UtcNow;
        var newAssignments = new List<TaskAssignment>();
        foreach (var registrationId in toActivate)
        {
            if (byRegistration.TryGetValue(registrationId, out var previous))
            {
                previous.Status = "ASSIGNED";
                previous.AssignedBy = userId;
                previous.AssignedAt = now;
                previous.StartedAt = null;
                previous.CompletedAt = null;
                previous.VolunteerNote = null;
                previous.ManagerNote = null;
                previous.UpdatedAt = now;
            }
            else
            {
                newAssignments.Add(new TaskAssignment
                {
                    TaskId = task.Id,
                    RegistrationId = registrationId,
                    AssignedBy = userId,
                    AssignedAt = now,
                    Status = "ASSIGNED",
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
        }
        repository.AddAssignments(newAssignments);
        task.UpdatedAt = now;
        await repository.Save(ct);
        task = await repository.Find(taskId, ct) ?? throw new ApiException(404, "Không tìm thấy task sau khi lưu phân công.");
        return ToView(task);
    }

    public async Task RemoveAssignment(Guid userId, Guid taskId, Guid assignmentId, CancellationToken ct)
    {
        ValidateIds(userId, taskId, assignmentId);
        var task = await repository.Find(taskId, ct) ?? throw new ApiException(404, "Không tìm thấy task.");
        await RequireTeamLead(userId, task.CampaignId, task.ActivityId, task.GroupId, ct);
        var assignment = await repository.FindAssignment(taskId, assignmentId, ct)
            ?? throw new ApiException(404, "Không tìm thấy phân công trong task này.");
        if (assignment.Status is "CANCELLED" or "DECLINED")
            throw new ApiException(409, "Phân công này đã được gỡ hoặc từ chối trước đó.");
        assignment.Status = "CANCELLED";
        assignment.UpdatedAt = DateTimeOffset.UtcNow;
        task.UpdatedAt = assignment.UpdatedAt;
        await repository.Save(ct);
    }

    public async Task<MyVolunteerTaskView[]> Mine(Guid userId, CancellationToken ct)
    {
        if (userId == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        return (await repository.Mine(userId, ct)).Select(ToMyTaskView).ToArray();
    }

    public async Task<MyVolunteerTaskView> Respond(Guid userId, Guid assignmentId, TaskResponseRequest request, CancellationToken ct)
    {
        var assignment = await repository.FindMyAssignment(userId, assignmentId, ct)
            ?? throw new ApiException(404, "Không tìm thấy nhiệm vụ của bạn.");
        await using var gate = await registrations.LockCampaign(assignment.Task.CampaignId, ct);
        db.ChangeTracker.Clear();
        assignment = await repository.FindMyAssignment(userId, assignmentId, ct)
            ?? throw new ApiException(404, "Không tìm thấy nhiệm vụ của bạn.");
        if (assignment.Status is "CANCELLED" or "COMPLETED" || assignment.Task.Status is "CANCELLED" or "COMPLETED" ||
            assignment.Registration.Status != "APPROVED" ||
            !assignment.Registration.GroupAssignments.Any(group => group.GroupId == assignment.Task.GroupId &&
                group.Status == "ACTIVE" && group.ConfirmedAt != null))
            throw new ApiException(409, "Nhiệm vụ hoặc ca tình nguyện hiện không còn hoạt động.");
        var note = request.Note?.Trim();
        if (!request.Accept && string.IsNullOrWhiteSpace(note)) throw new ApiException(400, "Ghi ngắn gọn vướng mắc để trưởng đội xử lý.");
        if (assignment.Status == "DECLINED")
        {
            if (!request.Accept && note == assignment.VolunteerNote) return ToMyTaskView(assignment);
            throw new ApiException(409, "Bạn đã báo vướng mắc. Trưởng đội cần giao lại nhiệm vụ.");
        }
        if (request.Accept && assignment.Status is "ACCEPTED" or "IN_PROGRESS") return ToMyTaskView(assignment);
        var now = DateTimeOffset.UtcNow;
        assignment.Status = request.Accept ? "ACCEPTED" : "DECLINED";
        assignment.VolunteerNote = note;
        if (!request.Accept) assignment.StartedAt = null;
        assignment.UpdatedAt = now;
        await repository.Save(ct);
        return ToMyTaskView(assignment);
    }

    public async Task<MyVolunteerTaskView> CompleteMyAssignment(Guid userId, Guid assignmentId, CancellationToken ct)
    {
        ValidateIds(userId, assignmentId);
        var assignment = await repository.FindMyAssignment(userId, assignmentId, ct)
            ?? throw new ApiException(404, "Không tìm thấy phân công task của bạn.");

        if (assignment.Status == "COMPLETED") return ToMyTaskView(assignment);
        if (assignment.Status is "CANCELLED" or "DECLINED")
            throw new ApiException(409, "Phân công đã bị hủy hoặc từ chối, không thể đánh dấu hoàn thành.");
        if (assignment.Registration.Status != "APPROVED" ||
            assignment.Task.Status is "CANCELLED" or "COMPLETED" ||
            !assignment.Registration.GroupAssignments.Any(group => group.CampaignId == assignment.Task.CampaignId &&
                group.GroupId == assignment.Task.GroupId && group.Status == "ACTIVE"))
            throw new ApiException(409, "Task hoặc tư cách tham gia nhóm hiện không còn hoạt động.");

        var now = DateTimeOffset.UtcNow;
        assignment.Status = "COMPLETED";
        assignment.CompletedAt = now;
        assignment.UpdatedAt = now;
        await repository.Save(ct);
        return ToMyTaskView(assignment);
    }

    private static MyVolunteerTaskView ToMyTaskView(TaskAssignment assignment) => new(
        assignment.Id, assignment.TaskId, assignment.Task.CampaignId, assignment.Task.ActivityId,
        assignment.Task.GroupId, assignment.Task.Name, assignment.Task.Description,
        assignment.Task.StartTime, assignment.Task.EndTime, assignment.Task.Priority,
        assignment.Task.Status, assignment.Status, assignment.AssignedAt, assignment.StartedAt,
        assignment.CompletedAt, assignment.VolunteerNote, assignment.ManagerNote);

    private async Task<CampaignTaskAccessResult> RequireTeamLead(Guid userId, Guid campaignId,
        Guid activityId, Guid groupId, CancellationToken ct)
    {
        var permission = await campaignAccess.Check(campaignId, activityId, groupId, userId, ct);
        if (!permission.CanManage)
            throw new ApiException(403, "Chỉ trưởng đội được CampaignService phân công cho nhóm và hoạt động này mới được quản lý task.");
        return permission;
    }

    private static void ValidateRequest(VolunteerTaskFieldsRequest request, CampaignTaskAccessResult access)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Description))
            throw new ApiException(400, "Tên task và nội dung công việc là bắt buộc.");
        if (request.RequiredVolunteers <= 0)
            throw new ApiException(400, "Số người cần cho task phải lớn hơn 0.");
        var priority = request.Priority.Trim().ToUpperInvariant();
        if (priority is not ("LOW" or "MEDIUM" or "HIGH" or "URGENT"))
            throw new ApiException(400, "Mức độ ưu tiên không hợp lệ.");
        if (request.StartTime.HasValue != request.EndTime.HasValue ||
            (request.StartTime is TimeOnly start && request.EndTime is TimeOnly end && start >= end))
            throw new ApiException(400, "Hãy nhập cả giờ bắt đầu và kết thúc; giờ bắt đầu phải trước giờ kết thúc.");
        if (request.StartTime is TimeOnly taskStart && access.ActivityStart is TimeOnly activityStart && taskStart < activityStart ||
            request.EndTime is TimeOnly taskEnd && access.ActivityEnd is TimeOnly activityEnd && taskEnd > activityEnd)
            throw new ApiException(400, "Thời gian task phải nằm trong khung giờ hoạt động của CampaignService.");
    }

    private static bool IsActiveAssignment(TaskAssignment assignment) =>
        assignment.Status is not ("CANCELLED" or "DECLINED");

    private static VolunteerTaskView ToView(VolunteerTask task)
    {
        var assignments = task.Assignments.OrderBy(x => x.AssignedAt).ThenBy(x => x.Id).ToArray();
        return new VolunteerTaskView(task.Id, task.CampaignId, task.ActivityId, task.GroupId,
            task.Name, task.Description, task.StartTime, task.EndTime, task.RequiredVolunteers,
            assignments.Count(IsActiveAssignment), task.Priority, task.Status, task.Note,
            task.CreatedBy, task.CreatedAt, task.UpdatedAt,
            assignments.Select(x => new VolunteerTaskAssignmentView(x.Id, x.RegistrationId,
                x.Registration.FullName, x.Status, x.AssignedBy, x.AssignedAt,
                x.StartedAt, x.CompletedAt, x.VolunteerNote, x.ManagerNote)).ToArray());
    }

    private static void ValidateIds(params Guid[] ids)
    {
        if (ids.Length > 0 && ids[0] == Guid.Empty) throw new ApiException(401, "Tài khoản đăng nhập không hợp lệ.");
        if (ids.Skip(1).Any(id => id == Guid.Empty)) throw new ApiException(400, "Mã chiến dịch, hoạt động, nhóm hoặc task không hợp lệ.");
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
