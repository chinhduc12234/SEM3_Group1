using System.Net;
using System.Net.Http.Json;
using DonationService.Contracts;
using Shared;

namespace DonationService.Services;

public sealed class CampaignDonationClient(IHttpClientFactory clients)
{
    public async Task<CampaignDonationContext> Get(Guid campaignId, CancellationToken ct, bool includeRecipients = true)
    {
        try
        {
            using var response = await clients.CreateClient("campaign-internal")
                .GetAsync($"internal/campaigns/{campaignId}/donation-context?includeRecipients={includeRecipients}", ct);
            if (response.StatusCode == HttpStatusCode.NotFound) throw new ApiException(404, "Chiến dịch chưa mở nhận quyên góp.");
            if (!response.IsSuccessStatusCode) throw new ApiException(503, "Chưa tải được mục tiêu quyên góp của chiến dịch.");
            return await response.Content.ReadFromJsonAsync<CampaignDonationContext>(ct)
                ?? throw new ApiException(503, "Thông tin chiến dịch không hợp lệ.");
        }
        catch (HttpRequestException) { throw new ApiException(503, "Không kết nối được dịch vụ chiến dịch."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new ApiException(503, "Tải thông tin chiến dịch quá thời gian."); }
    }

}

public sealed class DonationAccountDirectory(IHttpClientFactory clients)
{
    public async Task<AccountDonationRecipient> Get(Guid userId, CancellationToken ct)
    {
        try
        {
            using var response = await clients.CreateClient("identity-internal")
                .GetAsync($"internal/accounts/{userId}/notification-recipient", ct);
            if (!response.IsSuccessStatusCode) throw new ApiException(401, "Không xác minh được tài khoản ủng hộ.");
            return await response.Content.ReadFromJsonAsync<AccountDonationRecipient>(ct)
                ?? throw new ApiException(503, "Thông tin tài khoản không hợp lệ.");
        }
        catch (HttpRequestException) { throw new ApiException(503, "Không kết nối được dịch vụ tài khoản."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new ApiException(503, "Tải thông tin tài khoản quá thời gian."); }
    }
}
