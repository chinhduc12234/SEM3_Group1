using System.Net;
using System.Net.Http.Json;
using Shared;
using VolunteerService.Contracts;

namespace VolunteerService.Services;

public sealed class CampaignTaskAccessClient(IHttpClientFactory clients) : ICampaignTaskAccessClient
{
    public async Task<CampaignTaskAccessResult> Check(Guid campaignId, Guid activityId, Guid groupId,
        Guid userId, CancellationToken ct)
    {
        try
        {
            using var response = await clients.CreateClient("campaign-internal").GetAsync(
                $"internal/campaigns/{campaignId}/activities/{activityId}/groups/{groupId}/task-access/{userId}", ct);
            if (response.StatusCode == HttpStatusCode.NotFound)
                return new CampaignTaskAccessResult(false, 0, null, null);
            if (!response.IsSuccessStatusCode)
                throw new ApiException(503, "Chưa xác minh được quyền trưởng nhóm trong CampaignService.");
            return await response.Content.ReadFromJsonAsync<CampaignTaskAccessResult>(ct)
                ?? throw new ApiException(503, "Phản hồi kiểm tra quyền trưởng nhóm không hợp lệ.");
        }
        catch (HttpRequestException) { throw new ApiException(503, "Không kết nối được CampaignService để kiểm tra quyền trưởng nhóm."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { throw new ApiException(503, "CampaignService kiểm tra quyền trưởng nhóm quá thời gian."); }
    }
}
