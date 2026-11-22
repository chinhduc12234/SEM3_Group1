using System.Net;
using System.Net.Http.Json;
using Shared;

namespace VolunteerService.Services;

public sealed record CampaignReviewAccessResult(bool CanReview);

public sealed class CampaignReviewAccessClient(IHttpClientFactory clients) : ICampaignReviewAccessClient
{
    public async Task<bool> CanReview(Guid campaignId, Guid userId, CancellationToken ct)
    {
        try
        {
            using var response = await clients.CreateClient("campaign-internal")
                .GetAsync($"internal/campaigns/{campaignId}/volunteer-review-access/{userId}", ct);
            if (response.StatusCode == HttpStatusCode.NotFound) return false;
            if (!response.IsSuccessStatusCode)
                throw new ApiException(503, "Chưa xác minh được quyền xét duyệt tình nguyện viên.");
            return (await response.Content.ReadFromJsonAsync<CampaignReviewAccessResult>(ct))?.CanReview
                ?? throw new ApiException(503, "Phản hồi kiểm tra quyền xét duyệt không hợp lệ.");
        }
        catch (HttpRequestException) { throw new ApiException(503, "Không kết nối được CampaignService để kiểm tra quyền."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { throw new ApiException(503, "CampaignService kiểm tra quyền quá thời gian."); }
    }
}
