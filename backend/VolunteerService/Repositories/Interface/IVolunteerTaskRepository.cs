using VolunteerService.Data;

namespace VolunteerService.Repositories;

public interface IVolunteerTaskRepository
{
    Task<VolunteerTask[]> List(Guid campaignId, Guid activityId, Guid groupId, CancellationToken ct);
    Task<VolunteerTask?> Find(Guid taskId, CancellationToken ct);
    Task<TaskAssignment?> FindAssignment(Guid taskId, Guid assignmentId, CancellationToken ct);
    Task<TaskAssignment?> FindMyAssignment(Guid userId, Guid assignmentId, CancellationToken ct);
    Task<VolunteerRegistration[]> ActiveGroupRegistrations(Guid campaignId, Guid groupId,
        Guid[] registrationIds, CancellationToken ct);
    Task<TaskAssignment[]> AssignmentsForTask(Guid taskId, CancellationToken ct);
    Task<TaskAssignment[]> Mine(Guid userId, CancellationToken ct);
    void Add(VolunteerTask task);
    void AddAssignments(IEnumerable<TaskAssignment> assignments);
    Task Save(CancellationToken ct);
}
