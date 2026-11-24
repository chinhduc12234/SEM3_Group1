using System.Text.Json;
using DonationService.Contracts;
using DonationService.Data;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace DonationService.Services;

public sealed class FundraisingProgressService(DonationDb db)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<DonationSummary> Summary(CampaignDonationContext context, CancellationToken ct)
    {
        var confirmed = await db.Donations.AsNoTracking()
            .Where(x => x.CampaignId == context.CampaignId && x.Status == "CONFIRMED")
            .GroupBy(x => x.BudgetItemId)
            .Select(group => new { Id = group.Key, Amount = group.Sum(x => x.Amount), Count = group.Count() })
            .ToDictionaryAsync(x => x.Id, ct);
        var rawFinancialTargets = context.Targets.Select(target =>
        {
            var total = confirmed.GetValueOrDefault(target.Id);
            var donated = total?.Amount ?? 0m;
            return new DonationTargetProgress(target.Id, target.Name, target.Amount, donated,
                Math.Max(0m, target.Amount - donated), donated >= target.Amount, false);
        }).ToArray();
        var pledges = await db.InKindPledges.AsNoTracking()
            .Where(x => x.CampaignId == context.CampaignId && (x.Status == "APPROVED" || x.Status == "RECEIVED"))
            .GroupBy(x => x.BudgetItemId)
            .Select(group => new { Id = group.Key, Quantity = group.Sum(x => x.Quantity), Received = group.Sum(x => x.ReceivedQuantity) })
            .ToDictionaryAsync(x => x.Id, ct);
        var rawInKindTargets = context.InKindTargets.Where(x => x.AcceptsInKind).Select(target =>
        {
            var total = pledges.GetValueOrDefault(target.Id);
            var received = total?.Received ?? 0m;
            var reserved = Math.Max(0m, (total?.Quantity ?? 0m) - received);
            return new InKindTargetProgress(target.Id, target.Name, target.Quantity, target.Unit,
                received, reserved, Math.Max(0m, target.Quantity - received - reserved), received + reserved >= target.Quantity, false);
        }).ToArray();
        var rawMoneyById = rawFinancialTargets.ToDictionary(x => x.BudgetItemId);
        var rawGoodsById = rawInKindTargets.ToDictionary(x => x.BudgetItemId);
        var financialTargets = rawFinancialTargets.Select(target =>
        {
            var satisfiedByInKind = !target.IsComplete && rawGoodsById.TryGetValue(target.BudgetItemId, out var goods) && goods.IsComplete;
            return target with
            {
                IsComplete = target.IsComplete || satisfiedByInKind,
                RemainingAmount = satisfiedByInKind ? 0m : target.RemainingAmount,
                SatisfiedByInKind = satisfiedByInKind
            };
        }).ToArray();
        var inKindTargets = rawInKindTargets.Select(target =>
        {
            var satisfiedByMoney = !target.IsComplete && rawMoneyById.TryGetValue(target.BudgetItemId, out var money) && money.IsComplete;
            return target with
            {
                IsComplete = target.IsComplete || satisfiedByMoney,
                RemainingQuantity = satisfiedByMoney ? 0m : target.RemainingQuantity,
                SatisfiedByMoney = satisfiedByMoney
            };
        }).ToArray();
        var targetIds = rawMoneyById.Keys.Concat(rawGoodsById.Keys).Distinct().ToArray();
        var complete = targetIds.Length > 0 && targetIds.All(id =>
            (rawMoneyById.TryGetValue(id, out var money) && money.IsComplete) ||
            (rawGoodsById.TryGetValue(id, out var goods) && goods.IsComplete));
        var closed = complete || await db.FundraisingClosures.AsNoTracking().AnyAsync(x => x.CampaignId == context.CampaignId, ct);
        var targetAmount = financialTargets.Sum(x => x.TargetAmount);
        var donatedAmount = financialTargets.Sum(x => x.DonatedAmount);
        return new(context.CampaignId, targetAmount, donatedAmount, financialTargets.Sum(x => x.RemainingAmount),
            confirmed.Values.Sum(x => x.Count), financialTargets, inKindTargets, closed);
    }

    public async Task CloseIfComplete(CampaignDonationContext context, CancellationToken ct)
    {
        var summary = await Summary(context, ct);
        if (!summary.IsClosed || await db.FundraisingClosures.AnyAsync(x => x.CampaignId == context.CampaignId, ct)) return;
        var now = DateTimeOffset.UtcNow;
        var closure = new FundraisingClosure { CampaignId = context.CampaignId, ClosedAt = now };
        var item = new FundraisingGoalReachedNotificationEvent(Guid.NewGuid(), context.CampaignId,
            context.OrganizationId, context.CampaignTitle, context.ManagerUserIds, now);
        db.FundraisingClosures.Add(closure);
        db.NotificationOutbox.Add(new DonationNotificationOutbox
        {
            Id = item.EventId,
            Route = "internal/notifications/fundraising-goal-reached",
            Payload = JsonSerializer.Serialize(item, Json),
            NextAttemptAt = now
        });
        await db.SaveChangesAsync(ct);
    }
}
