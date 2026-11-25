using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared;
using VolunteerService.Data;

namespace VolunteerService.Controllers;

[ApiController, Route("internal/launch/campaigns")]
public sealed class InternalVolunteerLaunchController(VolunteerDb db, IConfiguration config) : ControllerBase
{
    [HttpGet("{campaignId:guid}/roster")]
    public async Task<LaunchRoster> Roster(Guid campaignId, CancellationToken ct)
    {
        RequireInternal();
        return await Snapshot(campaignId, ct);
    }

    [HttpPost("{campaignId:guid}/roster/hold")]
    public async Task<IActionResult> Hold(Guid campaignId, HoldLaunchRoster request, CancellationToken ct)
    {
        RequireInternal();
        if (request.Token == Guid.Empty || request.Revision.Length != 64)
            throw new ApiException(400, "Bản chốt đội hình không hợp lệ.");
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Volunteer.Registration.{campaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đội hình đang được cập nhật.");
        var now = DateTimeOffset.UtcNow;
        var hold = await db.LaunchRosterHolds.FindAsync([campaignId], ct);
        if (hold is not null && hold.ExpiresAt > now) throw new ApiException(409, "Đội hình đang được dùng để bắt đầu.");
        if ((await Snapshot(campaignId, ct)).Revision != request.Revision)
            throw new ApiException(409, "Đội hình vừa thay đổi. Cần kiểm tra lại.");
        if (hold is null)
        {
            hold = new VolunteerRosterHold { CampaignId = campaignId };
            db.LaunchRosterHolds.Add(hold);
        }
        hold.Token = request.Token;
        hold.ExpiresAt = now.AddSeconds(30);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{campaignId:guid}/roster/release")]
    public async Task<IActionResult> Release(Guid campaignId, HoldLaunchRoster request, CancellationToken ct)
    {
        RequireInternal();
        await db.LaunchRosterHolds.Where(item => item.CampaignId == campaignId && item.Token == request.Token).ExecuteDeleteAsync(ct);
        return NoContent();
    }

    private async Task<LaunchRoster> Snapshot(Guid campaignId, CancellationToken ct)
    {
        var rows = await db.GroupAssignments.AsNoTracking().Where(item => item.CampaignId == campaignId &&
                item.Status == "ACTIVE" && item.ConfirmedAt != null && item.Registration.Status == "APPROVED")
            .OrderBy(item => item.Id).Select(item => new { item.Id, item.GroupId, item.ConfirmedAt }).ToArrayAsync(ct);
        var version = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(rows)));
        return new(version, rows.GroupBy(item => item.GroupId).ToDictionary(group => group.Key, group => group.Count()));
    }

    [HttpPost("{campaignId:guid}/recipients")]
    public Task<Guid[]> Recipients(Guid campaignId, Guid[] groupIds, CancellationToken ct)
    {
        RequireInternal();
        if (groupIds.Length > 300) throw new ApiException(400, "Có quá nhiều nhóm trong yêu cầu.");
        var now = DateTimeOffset.UtcNow;
        return db.GroupAssignments.AsNoTracking().Where(item => item.CampaignId == campaignId &&
                groupIds.Contains(item.GroupId) && item.Status == "ACTIVE" && item.Registration.Status == "APPROVED" &&
                (item.ConfirmedAt != null || item.ConfirmBy == null || item.ConfirmBy > now))
            .Select(item => item.Registration.UserId).Distinct().ToArrayAsync(ct);
    }

    private void RequireInternal()
    {
        var key = config["InternalApi:LaunchKey"];
        var given = Request.Headers["X-Launch-Key"].ToString();
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(given) ||
            !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)),
                SHA256.HashData(Encoding.UTF8.GetBytes(given))))
            throw new ApiException(401, "Yêu cầu nội bộ không hợp lệ.");
    }
}
