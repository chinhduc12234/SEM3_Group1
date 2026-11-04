using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;
using OrganizationService.Contracts;
using Shared;

namespace OrganizationService.Services;

public sealed class WorkspaceAccess(OrganizationDb db)
{
    public static readonly string[] AssignableRoles = ["ORGANIZATION_MANAGER", "CAMPAIGN_MANAGER", "VOLUNTEER_COORDINATOR", "FINANCE_MANAGER", "STAFF"];
    public static readonly string[] FocusAreas = ["EDUCATION", "HEALTH", "POVERTY_RELIEF", "DISASTER_RELIEF", "ENVIRONMENT", "CHILDREN", "ELDERLY", "COMMUNITY"];
    public static string[] Roles(OrganizationMember member) => member.Role == "OWNER" ? ["OWNER"] : member.Roles.Select(x => x.Role).Order().ToArray();
    public static string[] ValidateRoles(string[] roles)
    {
        var selected = roles.Distinct().Order().ToArray();
        if (selected.Length == 0 || selected.Any(x => !AssignableRoles.Contains(x))) throw new ApiException(400, "Vai trò không hợp lệ; không được cấp OWNER hoặc ADMIN từ chức năng nhân sự.");
        return selected;
    }
    public async Task<Organization> Require(Guid id, OrganizationActor actor, bool adminRead = true, params string[] roles)
    {
        var organization = await db.Organizations.SingleOrDefaultAsync(x => x.Id == id && x.Status == "ACTIVE")
            ?? throw new ApiException(404, "Không tìm thấy tổ chức đang hoạt động.");
        if (adminRead && actor.IsAdmin) return organization;
        var member = await db.Members.Include(x => x.Roles).SingleOrDefaultAsync(x => x.OrganizationId == id && x.UserId == actor.UserId && x.IsActive);
        if (member is null) throw new ApiException(404, "Bạn không có quyền truy cập tổ chức này.");
        if (roles.Length > 0 && member.Role != "OWNER" && !Roles(member).Intersect(roles).Any()) throw new ApiException(403, "Vai trò hiện tại không được thực hiện thao tác này.");
        return organization;
    }
    public void Audit(Guid organizationId, Guid actor, string action, object detail) => db.Activities.Add(new OrganizationActivity
    { OrganizationId = organizationId, ActorUserId = actor, Action = action, Detail = JsonSerializer.Serialize(detail) });
    public static void Match(byte[] actual, string expected)
    {
        if (Convert.ToBase64String(actual) != expected) throw new ApiException(409, "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
    public async Task Save(CancellationToken cancellationToken)
    {
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ApiException(409, "Dữ liệu vừa được cập nhật bởi người khác. Vui lòng tải lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 })
        { throw new ApiException(409, "Thông tin bị trùng: số đăng ký, thành viên hoặc yêu cầu đang chờ xử lý đã tồn tại."); }
    }
    public static OrganizationWorkspace Initial(Organization org) => new()
    {
        OrganizationId = org.Id, DisplayName = org.Profile.LegalName, Introduction = org.Profile.Mission,
        Mission = org.Profile.Mission, ContactEmail = org.Profile.ContactEmail, ContactPhone = org.Profile.ContactPhone,
        Website = org.Profile.Website ?? "", Address = org.Profile.Address
    };
}
