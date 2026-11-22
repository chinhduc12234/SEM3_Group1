using Microsoft.EntityFrameworkCore;
using VolunteerService.Data;

namespace VolunteerService.Repositories;

public sealed class VolunteerTaskRepository(VolunteerDb db) : IVolunteerTaskRepository
{
    public Task<VolunteerTask[]> List(Guid campaignId, Guid activityId, Guid groupId, CancellationToken ct) =>
        db.Tasks.AsNoTracking().Where(x => x.CampaignId == campaignId && x.ActivityId == activityId &&
                x.GroupId == groupId)
            .Include(x => x.Assignments).ThenInclude(x => x.Registration)
            .OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).ToArrayAsync(ct);

    public Task<VolunteerTask?> Find(Guid taskId, CancellationToken ct) =>
        db.Tasks.Include(x => x.Assignments).ThenInclude(x => x.Registration)
            .SingleOrDefaultAsync(x => x.Id == taskId, ct);

    public Task<TaskAssignment?> FindAssignment(Guid taskId, Guid assignmentId, CancellationToken ct) =>
        db.TaskAssignments.SingleOrDefaultAsync(x => x.TaskId == taskId && x.Id == assignmentId, ct);

    public Task<TaskAssignment?> FindMyAssignment(Guid userId, Guid assignmentId, CancellationToken ct) =>
        db.TaskAssignments.Include(x => x.Task).Include(x => x.Registration)
            .ThenInclude(x => x.GroupAssignments)
            .SingleOrDefaultAsync(x => x.Id == assignmentId && x.Registration.UserId == userId, ct);

    public Task<VolunteerRegistration[]> ActiveGroupRegistrations(Guid campaignId, Guid groupId,
        Guid[] registrationIds, CancellationToken ct) =>
        db.Registrations.AsNoTracking().Where(registration => registrationIds.Contains(registration.Id) &&
                registration.CampaignId == campaignId && registration.Status == "APPROVED" &&
                registration.GroupAssignments.Any(assignment => assignment.GroupId == groupId && assignment.Status == "ACTIVE"))
            .ToArrayAsync(ct);

    public Task<TaskAssignment[]> AssignmentsForTask(Guid taskId, CancellationToken ct) =>
        db.TaskAssignments.Where(x => x.TaskId == taskId).ToArrayAsync(ct);

    public Task<TaskAssignment[]> Mine(Guid userId, CancellationToken ct) =>
        db.TaskAssignments.AsNoTracking()
            .Where(assignment => assignment.Registration.UserId == userId &&
                assignment.Registration.Status == "APPROVED" && assignment.Status != "CANCELLED" &&
                assignment.Status != "DECLINED" && assignment.Task.Status != "CANCELLED" &&
                assignment.Registration.GroupAssignments.Any(group => group.GroupId == assignment.Task.GroupId &&
                    group.CampaignId == assignment.Task.CampaignId && group.Status == "ACTIVE"))
            .Include(assignment => assignment.Task)
            .OrderBy(assignment => assignment.Task.ActivityId)
            .ThenBy(assignment => assignment.Task.StartTime)
            .ToArrayAsync(ct);

    public void Add(VolunteerTask task) => db.Tasks.Add(task);

    public void AddAssignments(IEnumerable<TaskAssignment> assignments) => db.TaskAssignments.AddRange(assignments);

    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}
