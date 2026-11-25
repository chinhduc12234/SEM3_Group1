using Shared;
using VolunteerService.Repositories;

namespace VolunteerService.Services;

public sealed class VolunteerOfferWorker(IServiceScopeFactory scopes, ILogger<VolunteerOfferWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var query = scopes.CreateAsyncScope();
                var repository = query.ServiceProvider.GetRequiredService<IVolunteerRegistrationRepository>();
                foreach (var campaignId in await repository.CampaignsWithQueue(DateTimeOffset.UtcNow, stoppingToken))
                {
                    await using var scope = scopes.CreateAsyncScope();
                    try { await scope.ServiceProvider.GetRequiredService<IVolunteerRegistrationService>().RefreshOffers(campaignId, stoppingToken); }
                    catch (ApiException exception) when (exception.Status == 409) { }
                    catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
                    { logger.LogWarning(exception, "Không cập nhật được suất tình nguyện của chiến dịch {CampaignId}", campaignId); }
                }
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            { logger.LogWarning(exception, "Không tìm được suất tình nguyện đến hạn"); }
        }
    }
}
