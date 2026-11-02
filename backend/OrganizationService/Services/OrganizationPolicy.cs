using OrganizationService.Contracts;
using OrganizationService.Data;
using Shared;

namespace OrganizationService.Services;

// Domain transitions and dossier validation stay independent of HTTP routing and persistence.
public static class OrganizationPolicy
{
    public static readonly string[] RequiredDocuments = ["REGISTRATION", "REPRESENTATIVE_ID", "AUTHORIZATION"];
    public static string Key(string number) => number.Trim().ToUpperInvariant();

    public static void EnsureEditable(Organization organization, Guid actor)
    {
        if (organization.ApplicantUserId != actor) throw new ApiException(403, "Chỉ người nộp mới được sửa hồ sơ.");
        if (organization.Status is not ("DRAFT" or "CHANGES_REQUESTED")) throw new ApiException(409, "Hồ sơ đang chờ duyệt hoặc đã kết thúc, không thể chỉnh sửa.");
    }
    public static void MatchVersion(Organization organization, string? version)
    {
        if (version != Convert.ToBase64String(organization.Version)) throw new ApiException(409, "Hồ sơ đã thay đổi. Vui lòng tải lại.");
    }
    public static void EnsureReadyToSubmit(Organization organization)
    {
        if (!organization.Consent || RequiredDocuments.Any(kind => !organization.Documents.Any(x => x.Kind == kind)))
            throw new ApiException(400, "Cần đủ giấy đăng ký, giấy tờ đại diện và văn bản chứng minh quyền đại diện.");
    }
    public static string ReviewStatus(Organization organization, Guid actor, string decision, string? reason)
    {
        if (organization.ApplicantUserId == actor) throw new ApiException(403, "Không được tự duyệt hồ sơ do mình nộp.");
        if (organization.Status != "PENDING_REVIEW") throw new ApiException(409, "Chỉ hồ sơ chờ duyệt mới được xử lý.");
        if (decision != "APPROVE" && string.IsNullOrWhiteSpace(reason)) throw new ApiException(400, "Cần nhập lý do hoặc nội dung cần bổ sung.");
        return decision switch { "APPROVE" => "ACTIVE", "REJECT" => "REJECTED", "REQUEST_CHANGES" => "CHANGES_REQUESTED", _ => throw new ApiException(400, "Quyết định không hợp lệ.") };
    }
    public static void Validate(OrganizationRequest request)
    {
        var profile = request.Profile;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (!request.Consent) throw new ApiException(400, "Cần xác nhận tính chính xác của hồ sơ và quyền đại diện.");
        if (profile.RegistrationDate == default || profile.RegistrationDate > today || profile.FoundedDate == default || profile.FoundedDate > today ||
            profile.IdentityIssuedDate == default || profile.IdentityIssuedDate > today || profile.RepresentativeBirthDate == default ||
            profile.IdentityIssuedDate < profile.RepresentativeBirthDate || profile.RepresentativeBirthDate > today.AddYears(-18) || profile.RepresentativeBirthDate < today.AddYears(-110))
            throw new ApiException(400, "Ngày cấp, ngày thành lập hoặc ngày sinh không hợp lệ; người đại diện phải đủ 18 tuổi.");
        if (new[] { profile.ContactPhone, profile.RepresentativePhone }.Any(phone => phone.Count(char.IsAsciiDigit) is < 8 or > 15))
            throw new ApiException(400, "Điện thoại cần có từ 8 đến 15 chữ số.");
        if (!string.IsNullOrWhiteSpace(profile.Website) && (!Uri.TryCreate(profile.Website, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")))
            throw new ApiException(400, "Website phải bắt đầu bằng http:// hoặc https://.");
        if (!System.Text.RegularExpressions.Regex.IsMatch(request.IdentityNumber.Trim(), profile.IdentityType == "CCCD" ? "^[0-9]{12}$" : "^[A-Za-z0-9]{6,20}$"))
            throw new ApiException(400, "Số CCCD gồm 12 chữ số; hộ chiếu gồm 6–20 chữ/số.");
        profile.LegalName = profile.LegalName.Trim(); profile.RegistrationNumber = Key(profile.RegistrationNumber);
        if (profile.LegalName.Length < 3 || profile.RegistrationNumber.Length < 3 || profile.Mission.Trim().Length < 30)
            throw new ApiException(400, "Tên, số đăng ký hoặc mục tiêu hoạt động chưa đầy đủ.");
    }
}
