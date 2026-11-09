using SkiaSharp;
using Shared;

namespace CampaignService.Services;

public sealed class SurveyImageProcessor : ISurveyImageProcessor
{
    public async Task<byte[]> Process(IFormFile file, CancellationToken ct)
    {
        if (file.Length is <= 0 or > 5 * 1024 * 1024) throw new ApiException(400, "Mỗi ảnh phải có dung lượng từ 1 byte đến 5 MB.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension is not (".jpg" or ".jpeg" or ".png")) throw new ApiException(400, "Chỉ chấp nhận ảnh JPG, JPEG hoặc PNG.");
        await using var input = new MemoryStream();
        await file.CopyToAsync(input, ct);
        using var data = SKData.CreateCopy(input.ToArray());
        using var codec = SKCodec.Create(data);
        if (codec is null || ((codec.EncodedFormat != SKEncodedImageFormat.Png || extension != ".png")
            && (codec.EncodedFormat != SKEncodedImageFormat.Jpeg || extension is not (".jpg" or ".jpeg"))))
            throw new ApiException(400, "Nội dung tệp không phải ảnh JPG/PNG hợp lệ hoặc không khớp phần mở rộng.");
        var info = codec.Info;
        if (info.Width > 8000 || info.Height > 8000 || (long)info.Width * info.Height > 20000000)
            throw new ApiException(400, "Ảnh vượt giới hạn 8000px mỗi chiều hoặc 20 triệu điểm ảnh.");
        using var bitmap = new SKBitmap(info.Width, info.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
        if (codec.GetPixels(bitmap.Info, bitmap.GetPixels()) != SKCodecResult.Success)
            throw new ApiException(400, "Không đọc được ảnh hoặc tệp ảnh bị hỏng.");
        // Persist freshly encoded pixels only, dropping scripts, appended payloads and private EXIF metadata.
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, 85);
        if (encoded is null || encoded.Size > 5 * 1024 * 1024)
            throw new ApiException(400, "Ảnh sau xử lý vượt 5 MB hoặc không thể mã hóa.");
        return encoded.ToArray();
    }
}
