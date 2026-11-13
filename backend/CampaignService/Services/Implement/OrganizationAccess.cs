using System.Net;
using System.Net.Http.Json;
using Shared;

namespace CampaignService.Services;

public sealed record OrganizationPermission(Guid OrganizationId, string OrganizationName, bool IsActive, string[] Roles);
public sealed class OrganizationAccess(IHttpClientFactory clients) : IOrganizationAccess
{
    public async Task<OrganizationPermission> Require(Guid org, Guid actor, string[] allowed, CancellationToken ct)
    {
        try
        {
            using var response = await clients.CreateClient("organization").GetAsync($"internal/organizations/{org}/campaign-access/{actor}", ct);
            if (response.StatusCode == HttpStatusCode.NotFound) throw new ApiException(404, "Không tìm thấy tổ chức.");
            if (!response.IsSuccessStatusCode) throw new ApiException(503, "Chưa kiểm tra được quyền tổ chức. Vui lòng thử lại.");
            var permission = await response.Content.ReadFromJsonAsync<OrganizationPermission>(ct)
                ?? throw new ApiException(503, "Phản hồi quyền tổ chức không hợp lệ.");
            if (permission.OrganizationId != org || !permission.IsActive || !permission.Roles.Intersect(allowed, StringComparer.Ordinal).Any())
                throw new ApiException(403, "Tổ chức chưa hoạt động hoặc tài khoản không có vai trò phù hợp.");
            return permission;
        }
        catch (HttpRequestException) { throw new ApiException(503, "Không kết nối được dịch vụ tổ chức."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new ApiException(503, "Kiểm tra quyền tổ chức quá thời gian."); }
    }
}
