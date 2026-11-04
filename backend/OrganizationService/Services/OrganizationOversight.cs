using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OrganizationService.Data;

namespace OrganizationService.Services;

public sealed class OrganizationOversight(OrganizationDb db)
{
    public async Task<object> Overview()
    {
        var active = db.Organizations.Where(x => x.Status == "ACTIVE");
        var activeMembers = db.Members.Where(x => x.IsActive && x.Organization.Status == "ACTIVE");
        return new
        {
            activeOrganizations = await active.CountAsync(),
            pendingApplications = await db.Organizations.CountAsync(x => x.Status == "PENDING_REVIEW"),
            activeMemberships = await activeMembers.CountAsync(), uniquePeople = await activeMembers.Select(x => x.UserId).Distinct().CountAsync(),
            pendingLegalChanges = await db.LegalChanges.CountAsync(x => x.State == "PENDING"),
            campaigns = (int?)null, events = (int?)null, donatedAmount = (decimal?)null,
            organizationsByType = await active.GroupBy(x => x.Profile.OrganizationType).Select(x => new { type = x.Key, count = x.Count() }).ToListAsync()
        };
    }

    public async Task<object?> Directory(int page,
        string search, string focus)
    {
        if (focus != "" && !WorkspaceAccess.FocusAreas.Contains(focus)) return null;
        var query = db.Organizations.AsNoTracking().Where(x => x.Status == "ACTIVE");
        if (search.Trim() != "") query = query.Where(x => x.Profile.LegalName.Contains(search.Trim()) || x.Profile.RepresentativeName.Contains(search.Trim()));
        if (focus != "") query = query.Where(x => db.Workspaces.Any(p => p.OrganizationId == x.Id && p.FocusAreasJson.Contains("\"" + focus + "\"")));
        var items = await query.OrderBy(x => x.Profile.LegalName).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20).Select(x => new
        {
            x.Id, x.Profile.LegalName, x.Profile.RepresentativeName, x.Profile.RepresentativeTitle, x.Profile.OrganizationType,
            memberCount = db.Members.Count(m => m.OrganizationId == x.Id && m.IsActive),
            staffCount = db.Members.Count(m => m.OrganizationId == x.Id && m.IsActive && m.Role != "OWNER"),
            focusAreasJson = db.Workspaces.Where(p => p.OrganizationId == x.Id).Select(p => p.FocusAreasJson).FirstOrDefault(),
            mission = db.Workspaces.Where(p => p.OrganizationId == x.Id).Select(p => p.Mission).FirstOrDefault()
        }).ToListAsync();
        return new { totalCount = await query.CountAsync(), page, pageSize = 20, items = items.Select(x => new
        {
            x.Id, x.LegalName, x.RepresentativeName, x.RepresentativeTitle, x.OrganizationType, x.memberCount, x.staffCount, x.mission,
            focusAreas = JsonSerializer.Deserialize<string[]>(x.focusAreasJson ?? "[]")
        }) };
    }

}
