using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DonationService.Contracts;
using DonationService.Data;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace DonationService.Services;

public sealed class DonationSandboxPaymentService(DonationDb db, CampaignDonationClient campaigns,
    DonationAccountDirectory accounts, FundraisingProgressService progress, IConfiguration configuration, IHostEnvironment environment)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan ResendInterval = TimeSpan.FromSeconds(30);
    internal const int HoldMinutes = 15;
    private const int MaxAttempts = 5;

    public string Availability(CampaignDonationContext context, DonationSummary summary, DateTimeOffset now)
    {
        if (!SandboxEnabled) return "UNAVAILABLE";
        if (summary.IsClosed || summary.Targets.Length == 0 || summary.Targets.All(target => target.IsComplete)) return "CLOSED";
        var today = LocalDate(context, now);
        if (context.OpensOn is { } start && today < start) return "SCHEDULED";
        if (context.ClosesOn is { } end && today > end) return "CLOSED";
        return "OPEN";
    }

    public async Task<DonationCreated> Create(Guid userId, CreateDonationRequest request, CancellationToken ct)
    {
        EnsureSandboxEnabled();
        if (request.CampaignId == Guid.Empty || request.BudgetItemId == Guid.Empty || request.RequestId == Guid.Empty ||
            request.Amount <= 0 || request.Amount != decimal.Truncate(request.Amount) || request.Amount > 1_000_000_000_000_000m)
            throw new ApiException(400, "Chọn khoản dự toán và nhập số tiền VND nguyên lớn hơn 0.");
        var context = await campaigns.Get(request.CampaignId, ct, includeRecipients: false);
        var donor = await accounts.Get(userId, ct);
        await using var gate = await Lock(context.CampaignId, ct);
        var now = DateTimeOffset.UtcNow;
        if (request.RequestId is Guid requestId)
        {
            var existing = await db.Donations.AsNoTracking().SingleOrDefaultAsync(item => item.DonorUserId == userId &&
                item.CampaignId == context.CampaignId && item.RequestId == requestId, ct);
            if (existing is not null)
            {
                if (existing.BudgetItemId != request.BudgetItemId || existing.Amount != request.Amount ||
                    existing.PublishDonorName != request.PublishDonorName)
                    throw new ApiException(409, "Mã yêu cầu đã được dùng cho nội dung ủng hộ khác.");
                return View(existing, now);
            }
        }
        var target = context.Targets.SingleOrDefault(item => item.Id == request.BudgetItemId)
            ?? throw new ApiException(400, "Khoản dự toán không thuộc mục tiêu gây quỹ công khai của chiến dịch.");
        var summary = await progress.Summary(context, ct);
        var targetProgress = OpenTarget(context, summary, target.Id, now);
        if (request.Amount > targetProgress.RemainingAmount - await PendingAmount(context.CampaignId, target.Id, Guid.Empty, now, ct))
            throw new ApiException(409, "Số tiền vượt quá phần mục tiêu còn thiếu; hãy nhập số tiền nhỏ hơn.");
        var donation = new DonationRecord
        {
            CampaignId = context.CampaignId, BudgetItemId = target.Id, DonorUserId = userId,
            RequestId = request.RequestId, PublishDonorName = request.PublishDonorName,
            DonorName = donor.FullName, DonorEmail = donor.Email, CampaignTitle = context.CampaignTitle,
            TargetName = target.Name, Amount = request.Amount, CreatedAt = now,
            Reference = "GA-DON-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant()
        };
        db.Donations.Add(donation);
        await db.SaveChangesAsync(ct);
        return View(donation, now);
    }

    public async Task<SandboxOtpIssued> IssueOtp(Guid donationId, Guid userId, string payerAccountNumber, CancellationToken ct)
    {
        EnsureSandboxEnabled();
        var account = payerAccountNumber.Trim();
        if (account.Length is < 6 or > 20 || account.Any(character => !char.IsAsciiDigit(character)))
            throw new ApiException(400, "Số tài khoản thử nghiệm chỉ gồm 6–20 chữ số.");
        var campaignId = await FindCampaign(donationId, userId, ct);
        var context = await campaigns.Get(campaignId, ct, includeRecipients: false);
        await using var gate = await Lock(campaignId, ct);
        var donation = await FindDonation(donationId, userId, ct);
        var now = DateTimeOffset.UtcNow;
        if (donation.Status == "CONFIRMED") throw new ApiException(409, "Khoản ủng hộ này đã được xác nhận.");
        RequireActive(donation, now);

        var summary = await progress.Summary(context, ct);
        OpenTarget(context, summary, donation.BudgetItemId, now);

        var challenge = await db.SandboxOtpChallenges.SingleOrDefaultAsync(x => x.DonationId == donation.Id, ct);
        if (challenge is not null && challenge.IssuedAt + ResendInterval > now)
            throw new ApiException(429, "Hãy đợi 30 giây kể từ lần phát OTP trước khi gửi lại.");
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        if (challenge is null)
        {
            challenge = new SandboxOtpChallenge { DonationId = donation.Id };
            db.SandboxOtpChallenges.Add(challenge);
        }
        challenge.CodeHash = HashCode(challenge.Id, code);
        challenge.IssuedAt = now;
        var holdEnds = donation.CreatedAt.AddMinutes(HoldMinutes);
        var otpEnds = now.Add(OtpLifetime);
        challenge.ExpiresAt = holdEnds < otpEnds ? holdEnds : otpEnds;
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
        var existing = await db.Donations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == donationId && x.DonorUserId == userId, ct)
            ?? throw new ApiException(404, "Không tìm thấy khoản ủng hộ.");
        if (existing.Status == "CONFIRMED") return View(existing, DateTimeOffset.UtcNow);
        var context = await campaigns.Get(existing.CampaignId, ct);
        await using var gate = await Lock(existing.CampaignId, ct);
        var donation = await FindDonation(donationId, userId, ct);
        var now = DateTimeOffset.UtcNow;
        if (donation.Status == "CONFIRMED") return View(donation, now);
        RequireActive(donation, now);
        if (donation.Status != "OTP_PENDING") throw new ApiException(409, "Hãy nhập số tài khoản sandbox để nhận OTP trước.");
        var challenge = await db.SandboxOtpChallenges.SingleOrDefaultAsync(x => x.DonationId == donation.Id, ct)
            ?? throw new ApiException(409, "Chưa tạo mã OTP sandbox cho giao dịch này.");
        if (challenge.UsedAt is not null) throw new ApiException(409, "Mã OTP này đã được sử dụng.");
        if (challenge.ExpiresAt <= now) throw new ApiException(410, "OTP đã hết hạn. Hãy gửi mã sandbox mới.");
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

        var summary = await progress.Summary(context, ct);
        var target = OpenTarget(context, summary, donation.BudgetItemId, now);
        var otherPending = await PendingAmount(context.CampaignId, target.BudgetItemId, donation.Id, now, ct);
        if (donation.Amount + otherPending > target.RemainingAmount)
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
        return View(donation, confirmedAt);
    }

    public async Task<DonationCreated> Resume(Guid id, Guid userId, CancellationToken ct) =>
        View(await FindDonation(id, userId, ct), DateTimeOffset.UtcNow);

    private async Task<SqlSessionLock> Lock(Guid campaignId, CancellationToken ct)
    {
        var gate = new SqlSessionLock(db.Database.GetDbConnection(), $"GiveAid.Fundraising.{campaignId:N}");
        try
        {
            if (await gate.Acquire(ct)) return gate;
            throw new ApiException(409, "Đang ghi nhận hỗ trợ khác cho chiến dịch này; vui lòng thử lại.");
        }
        catch
        {
            await gate.DisposeAsync();
            throw;
        }
    }

    private async Task<Guid> FindCampaign(Guid id, Guid userId, CancellationToken ct) =>
        await db.Donations.Where(item => item.Id == id && item.DonorUserId == userId)
            .Select(item => (Guid?)item.CampaignId).SingleOrDefaultAsync(ct)
        ?? throw new ApiException(404, "Không tìm thấy khoản ủng hộ.");

    private async Task<DonationRecord> FindDonation(Guid id, Guid userId, CancellationToken ct) =>
        await db.Donations.SingleOrDefaultAsync(item => item.Id == id && item.DonorUserId == userId, ct)
        ?? throw new ApiException(404, "Không tìm thấy khoản ủng hộ.");

    private async Task<decimal> PendingAmount(Guid campaignId, Guid targetId, Guid excludedId, DateTimeOffset now, CancellationToken ct)
    {
        var cutoff = now.AddMinutes(-HoldMinutes);
        return await db.Donations.Where(item => item.CampaignId == campaignId && item.BudgetItemId == targetId &&
            item.Id != excludedId && (item.Status == "PENDING" || item.Status == "OTP_PENDING") && item.CreatedAt > cutoff)
            .SumAsync(item => (decimal?)item.Amount, ct) ?? 0m;
    }

    private DonationTargetProgress OpenTarget(CampaignDonationContext context, DonationSummary summary, Guid targetId, DateTimeOffset now)
    {
        var target = summary.Targets.SingleOrDefault(item => item.BudgetItemId == targetId && !item.IsComplete);
        if (Availability(context, summary, now) != "OPEN" || target is null)
            throw new ApiException(409, "Hạng mục này hiện không nhận ủng hộ tài chính.");
        return target;
    }

    private static void RequireActive(DonationRecord donation, DateTimeOffset now)
    {
        if (donation.CreatedAt.AddMinutes(HoldMinutes) <= now || donation.Status == "EXPIRED")
            throw new ApiException(410, "Giao dịch sandbox đã hết hạn. Vui lòng tạo khoản ủng hộ mới.");
        if (donation.Status is not ("PENDING" or "OTP_PENDING")) throw new ApiException(409, "Trạng thái giao dịch sandbox không hợp lệ.");
    }

    private static DateOnly LocalDate(CampaignDonationContext context, DateTimeOffset now)
    {
        var timezone = TimeZoneInfo.FindSystemTimeZoneById(context.Timezone ?? "Asia/Ho_Chi_Minh");
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, timezone).DateTime);
    }

    private bool SandboxEnabled => environment.IsDevelopment() && configuration.GetValue<bool>("PaymentSandbox:Enabled");

    private void EnsureSandboxEnabled()
    {
        if (!SandboxEnabled)
            throw new ApiException(404, "Thanh toán sandbox chỉ được bật trong môi trường phát triển.");
    }

    private string HashCode(Guid challengeId, string code)
    {
        var pepper = configuration["InternalApi:Key"];
        if (string.IsNullOrWhiteSpace(pepper)) throw new ApiException(503, "Chưa cấu hình sandbox payment.");
        var payload = Encoding.UTF8.GetBytes($"{challengeId:N}:{code}");
        return Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(pepper), payload));
    }

    private static DonationCreated View(DonationRecord donation, DateTimeOffset now)
    {
        var expiresAt = donation.CreatedAt.AddMinutes(HoldMinutes);
        var status = donation.Status is "PENDING" or "OTP_PENDING" && expiresAt <= now ? "EXPIRED" : donation.Status;
        return new(donation.Id, donation.CampaignId, donation.BudgetItemId, donation.CampaignTitle, donation.TargetName,
            donation.Amount, status, donation.PaymentMethod, donation.Reference, donation.CreatedAt, donation.ConfirmedAt, expiresAt);
    }
}
