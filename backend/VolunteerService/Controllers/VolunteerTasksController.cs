using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VolunteerService.Contracts;
using VolunteerService.Services;

namespace VolunteerService.Controllers;

[ApiController, Authorize, Route("api/volunteers")]
public sealed class VolunteerTasksController(IVolunteerTaskService service) : ControllerBase
{
    private Guid Actor => Guid.TryParse(User.FindFirstValue("sub"), out var userId)
        ? userId
        : throw new Shared.ApiException(401, "Tài khoản đăng nhập không hợp lệ.");

    [HttpGet("campaigns/{campaignId:guid}/activities/{activityId:guid}/groups/{groupId:guid}/tasks")]
    public Task<VolunteerTaskView[]> List(Guid campaignId, Guid activityId, Guid groupId, CancellationToken ct) =>
        service.List(Actor, campaignId, activityId, groupId, ct);

    [HttpPost("tasks")]
    public async Task<IActionResult> Create(CreateVolunteerTaskRequest request, CancellationToken ct)
    {
        var result = await service.Create(Actor, request, ct);
        return Created($"/api/volunteers/tasks/{result.Id}", result);
    }

    [HttpGet("tasks/{taskId:guid}")]
    public Task<VolunteerTaskView> Get(Guid taskId, CancellationToken ct) => service.Get(Actor, taskId, ct);

    [HttpPut("tasks/{taskId:guid}")]
    public Task<VolunteerTaskView> Update(Guid taskId, UpdateVolunteerTaskRequest request, CancellationToken ct) =>
        service.Update(Actor, taskId, request, ct);

    [HttpDelete("tasks/{taskId:guid}")]
    public async Task<IActionResult> Cancel(Guid taskId, CancellationToken ct)
    {
        await service.Cancel(Actor, taskId, ct);
        return NoContent();
    }

    [HttpPost("tasks/{taskId:guid}/assignments")]
    public Task<VolunteerTaskView> Assign(Guid taskId, AssignVolunteersToTaskRequest request, CancellationToken ct) =>
        service.Assign(Actor, taskId, request, ct);

    [HttpDelete("tasks/{taskId:guid}/assignments/{assignmentId:guid}")]
    public async Task<IActionResult> RemoveAssignment(Guid taskId, Guid assignmentId, CancellationToken ct)
    {
        await service.RemoveAssignment(Actor, taskId, assignmentId, ct);
        return NoContent();
    }

    [HttpGet("me/tasks")]
    public Task<MyVolunteerTaskView[]> Mine(CancellationToken ct) => service.Mine(Actor, ct);

    [HttpPost("me/tasks/{assignmentId:guid}/complete")]
    public Task<MyVolunteerTaskView> CompleteMyAssignment(Guid assignmentId, CancellationToken ct) =>
        service.CompleteMyAssignment(Actor, assignmentId, ct);
}
