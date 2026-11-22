using System.Net;
using System.Net.Http.Json;
using Shared;
using VolunteerService.Contracts;

namespace VolunteerService.Services;

public sealed class CampaignOpeningsClient(IHttpClientFactory clients) : ICampaignOpeningsClient
{
    public async Task<CampaignVolunteerOpenings?> Get(Guid campaignId, CancellationToken ct)
    {
        try
        {
            using var response = await clients.CreateClient("campaign")
                .GetAsync($"api/campaigns/{campaignId}/volunteer-openings", ct);
            if (response.StatusCode == HttpStatusCode.NotFound) return null;
            if (!response.IsSuccessStatusCode)
                throw new ApiException(503, "Chưa xác minh được chiến dịch và nhóm tình nguyện. Vui lòng thử lại.");
            return await response.Content.ReadFromJsonAsync<CampaignVolunteerOpenings>(ct)
                ?? throw new ApiException(503, "Danh sách nhóm tình nguyện từ CampaignService không hợp lệ.");
        }
        catch (HttpRequestException) { throw new ApiException(503, "Không kết nối được CampaignService."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { throw new ApiException(503, "CampaignService phản hồi quá thời gian."); }
    }
}
