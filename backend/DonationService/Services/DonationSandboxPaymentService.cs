using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DonationService.Contracts;
using DonationService.Data;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace DonationService.Services;

public sealed class DonationSandboxPaymentService(DonationDb db, CampaignDonationClient campaigns,
    FundraisingProgressService progress, IConfiguration configuration, IHostEnvironment environment)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(3);
    private const int MaxAttempts = 5;

    public async Task<SandboxOtpIssued> IssueOtp(Guid donationId, Guid userId, string payerAccountNumber, CancellationToken ct)
    {
        EnsureSandboxEnabled();
        var account = payerAccountNumber.Trim();
        if (account.Length is < 6 or > 20 || account.Any(character => !char.IsAsciiDigit(character)))
            throw new ApiException(400, "Số tài khoản thử nghiệm chỉ gồm 6–20 chữ số.");
        var donation = await db.Donations.SingleOrDefaultAsync(x => x.Id == donationId && x.DonorUserId == userId, ct)
            ?? throw new ApiException(404, "Không tìm thấy khoản ủng hộ.");
        if (donation.Status == "CONFIRMED") throw new ApiException(409, "Khoản ủng hộ này đã được xác nhận.");
        if (donation.Status is not ("PENDING" or "OTP_PENDING")) throw new ApiException(409, "Trạng thái giao dịch sandbox không hợp lệ.");

        var context = await campaigns.Get(donation.CampaignId, ct);
        var target = context.Targets.SingleOrDefault(x => x.Id == donation.BudgetItemId)
            ?? throw new ApiException(409, "Khoản dự toán đã thay đổi; không thể tiếp tục giao dịch.");
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{context.CampaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đang ghi nhận hỗ trợ khác cho chiến dịch này; vui lòng thử lại.");
        var summary = await progress.Summary(context, ct);
        var targetProgress = summary.Targets.SingleOrDefault(x => x.BudgetItemId == target.Id);
        if (summary.IsClosed || targetProgress is null || targetProgress.IsComplete)
            throw new ApiException(409, "Mục tiêu này đã đủ; chiến dịch không nhận thêm khoản ủng hộ này.");

        var now = DateTimeOffset.UtcNow;
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var challenge = await db.SandboxOtpChallenges.SingleOrDefaultAsync(x => x.DonationId == donation.Id, ct);
        if (challenge is null)
        {
            challenge = new SandboxOtpChallenge { DonationId = donation.Id };
            db.SandboxOtpChallenges.Add(challenge);
        }
        challenge.CodeHash = HashCode(challenge.Id, code);
        challenge.IssuedAt = now;
        challenge.ExpiresAt = now.Add(OtpLifetime);
        challenge.FailedAttempts = 0;
        challenge.UsedAt = null;
        donation.PayerAccountLast4 = account[^4..];
        donation.Status = "OTP_PENDING";
        await db.SaveChangesAsync(ct);

        // The generated code is deliberately visible only in the local Development sandbox.
        return new(donation.Id, donation.Reference, donation.PayerAccountLast4, challenge.ExpiresAt,
            environment.IsDevelopment() ? code : null);
    }

    public async Task<DonationCreated> Confirm(Guid donationId, Guid userId, string code, CancellationToken ct)
    {
        EnsureSandboxEnabled();
        var donation = await db.Donations.SingleOrDefaultAsync(x => x.Id == donationId && x.DonorUserId == userId, ct)
            ?? throw new ApiException(404, "Không tìm thấy khoản ủng hộ.");
        if (donation.Status == "CONFIRMED") return View(donation);
        if (donation.Status != "OTP_PENDING") throw new ApiException(409, "Hãy nhập số tài khoản sandbox để nhận OTP trước.");
        var challenge = await db.SandboxOtpChallenges.SingleOrDefaultAsync(x => x.DonationId == donation.Id, ct)
            ?? throw new ApiException(409, "Chưa tạo mã OTP sandbox cho giao dịch này.");
        if (challenge.UsedAt is not null) throw new ApiException(409, "Mã OTP này đã được sử dụng.");
        if (challenge.ExpiresAt <= DateTimeOffset.UtcNow) throw new ApiException(410, "OTP đã hết hạn. Hãy gửi mã sandbox mới.");
        if (challenge.FailedAttempts >= MaxAttempts) throw new ApiException(429, "Đã nhập sai OTP quá số lần cho phép. Hãy gửi mã sandbox mới.");

        var expected = Convert.FromHexString(challenge.CodeHash);
        var supplied = Convert.FromHexString(HashCode(challenge.Id, code));
        if (!CryptographicOperations.FixedTimeEquals(expected, supplied))
        {
            challenge.FailedAttempts++;
            await db.SaveChangesAsync(ct);
            throw new ApiException(challenge.FailedAttempts >= MaxAttempts ? 429 : 400,
                challenge.FailedAttempts >= MaxAttempts ? "Đã nhập sai OTP quá số lần cho phép. Hãy gửi mã sandbox mới." : "OTP sandbox không đúng.");
        }

        var context = await campaigns.Get(donation.CampaignId, ct);
        var target = context.Targets.SingleOrDefault(x => x.Id == donation.BudgetItemId)
            ?? throw new ApiException(409, "Khoản dự toán đã thay đổi; không thể xác nhận khoản ủng hộ.");
        await using var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{context.CampaignId:N}");
        if (!await gate.Acquire(ct)) throw new ApiException(409, "Đang ghi nhận hỗ trợ khác cho chiến dịch này; vui lòng thử lại.");
        var summary = await progress.Summary(context, ct);
        var targetProgress = summary.Targets.SingleOrDefault(x => x.BudgetItemId == target.Id);
        var otherPending = await db.Donations.Where(x => x.CampaignId == context.CampaignId && x.BudgetItemId == target.Id &&
            x.Id != donation.Id && (x.Status == "PENDING" || x.Status == "OTP_PENDING") &&
            x.CreatedAt > DateTimeOffset.UtcNow.AddMinutes(-15)).SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        if (summary.IsClosed || targetProgress is null || donation.Amount + otherPending > targetProgress.RemainingAmount)
            throw new ApiException(409, "Mục tiêu đã đủ hoặc không còn đủ số dư cho giao dịch này. Tạo khoản mới với số tiền nhỏ hơn nếu còn mục tiêu khác.");
        var confirmedAt = DateTimeOffset.UtcNow;
        var eventItem = new DonationConfirmedNotificationEvent(donation.Id, donation.Id, donation.CampaignId,
            context.OrganizationId, donation.DonorUserId, donation.DonorName, donation.Amount, target.Name,
            context.CampaignTitle, context.ManagerUserIds, confirmedAt);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        challenge.UsedAt = confirmedAt;
        donation.Status = "CONFIRMED";
        donation.ConfirmedAt = confirmedAt;
        db.NotificationOutbox.Add(new DonationNotificationOutbox
        {
            Id = donation.Id,
            Payload = JsonSerializer.Serialize(eventItem, Json),
            NextAttemptAt = confirmedAt
        });
        await db.SaveChangesAsync(ct);
        await progress.CloseIfComplete(context, ct);
        await transaction.CommitAsync(ct);
        return View(donation);
    }

    private void EnsureSandboxEnabled()
    {
        if (!environment.IsDevelopment() || !configuration.GetValue<bool>("PaymentSandbox:Enabled"))
            throw new ApiException(404, "Thanh toán sandbox chỉ được bật trong môi trường phát triển.");
    }

    private string HashCode(Guid challengeId, string code)
    {
        var pepper = configuration["InternalApi:Key"];
        if (string.IsNullOrWhiteSpace(pepper)) throw new ApiException(503, "Chưa cấu hình sandbox payment.");
        var payload = Encoding.UTF8.GetBytes($"{challengeId:N}:{code}");
        return Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(pepper), payload));
    }

    private static DonationCreated View(DonationRecord donation) => new(donation.Id, donation.CampaignId,
        donation.BudgetItemId, donation.CampaignTitle, donation.TargetName, donation.Amount,
        donation.Status, donation.PaymentMethod, donation.Reference, donation.CreatedAt);
}
