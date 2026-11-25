using VolunteerService.Contracts;

namespace VolunteerService.Services;

public interface IVolunteerTaskService
{
    Task<VolunteerTaskView[]> List(Guid userId, Guid campaignId, Guid activityId, Guid groupId, CancellationToken ct);
    Task<VolunteerTaskCandidate[]> Candidates(Guid userId, Guid campaignId, Guid activityId, Guid groupId, CancellationToken ct);
    Task<VolunteerTaskView> Get(Guid userId, Guid taskId, CancellationToken ct);
    Task<VolunteerTaskView> Create(Guid userId, CreateVolunteerTaskRequest request, CancellationToken ct);
    Task<VolunteerTaskView> Update(Guid userId, Guid taskId, UpdateVolunteerTaskRequest request, CancellationToken ct);
    Task Cancel(Guid userId, Guid taskId, CancellationToken ct);
    Task<VolunteerTaskView> Assign(Guid userId, Guid taskId, AssignVolunteersToTaskRequest request, CancellationToken ct);
    Task RemoveAssignment(Guid userId, Guid taskId, Guid assignmentId, CancellationToken ct);
    Task<MyVolunteerTaskView[]> Mine(Guid userId, CancellationToken ct);
    Task<MyVolunteerTaskView> Respond(Guid userId, Guid assignmentId, TaskResponseRequest request, CancellationToken ct);
    Task<MyVolunteerTaskView> CompleteMyAssignment(Guid userId, Guid assignmentId, CancellationToken ct);
}
