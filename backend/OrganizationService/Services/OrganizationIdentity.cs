using Microsoft.AspNetCore.DataProtection;

namespace OrganizationService.Services;

internal static class OrganizationIdentity
{
    public static string Read(IDataProtector protector, string storedValue)
    {
        // The local role seed marks profiles that have no legal identity number.
        return storedValue == "DEMO-SEED-NO-REAL-ID" ? "" : protector.Unprotect(storedValue);
    }
}
