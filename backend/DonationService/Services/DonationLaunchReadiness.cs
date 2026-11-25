using System.Security.Cryptography;
using System.Text.Json;
using DonationService.Data;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace DonationService.Services;

public sealed class DonationLaunchReadiness(DonationDb db, CampaignDonationClient campaigns, FundraisingProgressService progress)
{
    public async Task<LaunchGoodsSnapshot> Snapshot(Guid campaignId, CancellationToken ct)
    {
        var context = await campaigns.Get(campaignId, ct, includeRecipients: false);
        return await Snapshot(context, ct);
    }

    public async Task Hold(Guid campaignId, HoldLaunchGoods request, CancellationToken ct)
    {
        if (request.Token == Guid.Empty || request.Revision is not { Length: 64 })
            throw new ApiException(400, "Bản chốt hiện vật không hợp lệ.");
        var context = await campaigns.Get(campaignId, ct, includeRecipients: false);
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{campaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Số thực nhận đang được cập nhật.");
        var active = await db.LaunchGoodsHolds.FindAsync([campaignId], ct);
        if (active is not null && active.ExpiresAt > DateTimeOffset.UtcNow)
            throw new ApiException(409, "Số thực nhận đang được chốt để bắt đầu.");
        if ((await Snapshot(context, ct)).Revision != request.Revision)
            throw new ApiException(409, "Số thực nhận vừa thay đổi. Cần kiểm tra lại.");

        if (active is null)
        {
            active = new DonationLaunchGoodsHold { CampaignId = campaignId };
            db.LaunchGoodsHolds.Add(active);
        }
        active.Token = request.Token;
        active.ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(30);
        await db.SaveChangesAsync(ct);
    }

    public Task Release(Guid campaignId, Guid token, CancellationToken ct) =>
        db.LaunchGoodsHolds.Where(item => item.CampaignId == campaignId && item.Token == token).ExecuteDeleteAsync(ct);

    // Called while holding the fundraising lock, which is also used to acquire the launch hold.
    public async Task EnsureReceiptsEditable(Guid campaignId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        if (await db.LaunchGoodsHolds.AnyAsync(item => item.CampaignId == campaignId && item.ExpiresAt > now, ct))
            throw new ApiException(409, "Số thực nhận đang được chốt để bắt đầu. Vui lòng thử lại sau ít giây.");
    }

    private async Task<LaunchGoodsSnapshot> Snapshot(DonationService.Contracts.CampaignDonationContext context, CancellationToken ct)
    {
        var summary = await progress.Summary(context, ct);
        var targets = summary.InKindTargets.OrderBy(item => item.BudgetItemId)
            .Select(item => new LaunchGoodsTarget(item.BudgetItemId, item.ReceivedQuantity, item.TargetQuantity)).ToArray();
        return new(Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(targets))), targets);
    }
}
