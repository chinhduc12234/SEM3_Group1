using System.Security.Claims;

namespace OrganizationService.Contracts;

public readonly record struct OrganizationActor(Guid UserId, bool IsAdmin)
{
    public static OrganizationActor From(ClaimsPrincipal user) =>
        new(Guid.Parse(user.FindFirstValue("sub")!), user.IsInRole("ADMIN"));
}
