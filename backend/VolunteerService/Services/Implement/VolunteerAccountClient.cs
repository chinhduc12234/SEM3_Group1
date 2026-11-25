using System.Net;
using System.Net.Http.Json;
using Shared;

namespace VolunteerService.Services;

public sealed record VolunteerAccount(string FullName, string Email);

public sealed class VolunteerAccountClient(IHttpClientFactory clients)
{
    public async Task<VolunteerAccount> Get(Guid userId, CancellationToken ct)
    {
        try
        {
            using var response = await clients.CreateClient("identity-internal")
                .GetAsync($"internal/accounts/{userId}/notification-recipient", ct);
            if (response.StatusCode == HttpStatusCode.NotFound) throw new ApiException(401, "Tài khoản không còn hoạt động.");
            if (!response.IsSuccessStatusCode) throw new ApiException(503, "Chưa xác minh được tài khoản.");
            return await response.Content.ReadFromJsonAsync<VolunteerAccount>(ct)
                ?? throw new ApiException(503, "Phản hồi tài khoản không hợp lệ.");
        }
        catch (HttpRequestException) { throw new ApiException(503, "Không kết nối được dịch vụ tài khoản."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new ApiException(503, "Xác minh tài khoản quá thời gian."); }
    }
}
