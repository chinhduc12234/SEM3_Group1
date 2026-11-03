using Shared;

namespace OrganizationService.Services;

public static class OrganizationFiles
{
    public static async Task<(byte[] Bytes, string ContentType, string Extension)> Read(IFormFile file, bool imageOnly, int maxBytes, CancellationToken cancellationToken)
    {
        if (file.Length <= 0 || file.Length > maxBytes) throw new ApiException(400, $"Tệp vượt dung lượng cho phép ({maxBytes / 1024 / 1024} MB) hoặc rỗng.");
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream, cancellationToken);
        var bytes = stream.ToArray();
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var type = extension switch
        {
            ".png" when bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) => "image/png",
            ".jpg" or ".jpeg" when bytes.AsSpan().StartsWith(new byte[] { 0xff, 0xd8, 0xff }) => "image/jpeg",
            ".pdf" when !imageOnly && bytes.AsSpan().StartsWith("%PDF-"u8) => "application/pdf",
            _ => throw new ApiException(400, imageOnly ? "Chỉ nhận ảnh PNG/JPG hợp lệ." : "Chỉ nhận PDF, PNG, JPG hợp lệ.")
        };
        return (bytes, type, extension);
    }
}
