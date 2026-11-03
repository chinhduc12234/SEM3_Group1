using System.Net;
using System.Net.Http.Json;
using Shared;

namespace OrganizationService.Services;

public sealed record DirectoryAccount(Guid Id, string FullName, string Email, bool IsActive, bool IsAdmin);

public sealed class IdentityDirectory(IHttpClientFactory clients)
{
    public async Task<DirectoryAccount> Lookup(string email, CancellationToken cancellationToken)
    {
        using var response = await clients.CreateClient("identity-notifications").PostAsJsonAsync("internal/accounts/lookup", new { email }, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound) throw new ApiException(400, "Email chưa có tài khoản đang hoạt động. Thành viên cần đăng ký tài khoản trước.");
        if (!response.IsSuccessStatusCode) throw new ApiException(503, "Chưa kết nối được dịch vụ tài khoản. Vui lòng thử lại.");
        return await response.Content.ReadFromJsonAsync<DirectoryAccount>(cancellationToken) ?? throw new ApiException(503, "Không đọc được thông tin tài khoản.");
    }

    public async Task<Dictionary<Guid, DirectoryAccount>> Read(IEnumerable<Guid> ids, CancellationToken cancellationToken)
    {
        var result = new Dictionary<Guid, DirectoryAccount>();
        foreach (var batch in ids.Distinct().Chunk(100))
        {
            using var response = await clients.CreateClient("identity-notifications").PostAsJsonAsync("internal/accounts/directory", batch, cancellationToken);
            if (!response.IsSuccessStatusCode) throw new ApiException(503, "Chưa tải được danh sách tài khoản. Vui lòng thử lại.");
            foreach (var account in await response.Content.ReadFromJsonAsync<DirectoryAccount[]>(cancellationToken) ?? []) result[account.Id] = account;
        }
        return result;
    }
}
