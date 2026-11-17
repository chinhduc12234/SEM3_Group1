using Microsoft.AspNetCore.DataProtection;
using OrganizationService.Contracts;
using Shared;

namespace OrganizationService.Services;

public sealed class PersonnelProfiles(IDataProtectionProvider protection)
{
    public async Task<(string Name, string? Phone, string? Identity, string? Photo)> Protect(
        Guid organizationId, PersonnelProfileRequest profile, CancellationToken cancellationToken)
    {
        var name = profile.FullName.Trim();
        if (name.Length < 2) throw new ApiException(400, "Họ và tên phải có ít nhất 2 ký tự.");
        var phone = string.IsNullOrWhiteSpace(profile.Phone) ? null : profile.Phone.Trim();
        if (phone is not null && phone.Count(char.IsAsciiDigit) is < 8 or > 15)
            throw new ApiException(400, "Số điện thoại phải có từ 8 đến 15 chữ số.");

        var identity = string.IsNullOrEmpty(profile.IdentityNumber)
            ? null : Protector(organizationId, "Identity").Protect(profile.IdentityNumber);
        string? photo = null;
        if (!string.IsNullOrEmpty(profile.Photo))
        {
            const int maxBytes = 256 * 1024;
            var parts = profile.Photo.Split(',', 2);
            var extension = parts[0] switch
            {
                "data:image/png;base64" => ".png",
                "data:image/jpeg;base64" => ".jpg",
                _ => null
            };
            if (parts.Length != 2 || extension is null)
                throw new ApiException(400, "Ảnh nhân sự phải là PNG hoặc JPG.");

            var bytes = new byte[maxBytes];
            if (!Convert.TryFromBase64String(parts[1], bytes, out var length) || length == 0)
                throw new ApiException(400, "Ảnh nhân sự không hợp lệ hoặc vượt quá 256 KB.");
            var upload = new OrganizationUpload("avatar" + extension, length, () => new MemoryStream(bytes, 0, length));
            var image = await OrganizationFiles.Read(upload, true, maxBytes, cancellationToken);
            photo = Protector(organizationId, "Photo").Protect($"data:{image.ContentType};base64,{Convert.ToBase64String(image.Bytes)}");
        }
        return (name, phone, identity, photo);
    }

    public string? ReadIdentity(Guid organizationId, string? data) =>
        data is null ? null : Protector(organizationId, "Identity").Unprotect(data);

    public string? ReadPhoto(Guid organizationId, string? data) =>
        data is null ? null : Protector(organizationId, "Photo").Unprotect(data);

    private IDataProtector Protector(Guid organizationId, string kind) =>
        protection.CreateProtector("GiveAid.Organization.Personnel.v1", organizationId.ToString("N"), kind);
}
