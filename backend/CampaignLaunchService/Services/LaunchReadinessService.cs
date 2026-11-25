using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using CampaignLaunchService.Contracts;
using Shared;

namespace CampaignLaunchService.Services;

public sealed class LaunchReadinessService(IHttpClientFactory clients, ILogger<LaunchReadinessService> logger)
{
    private sealed record Evaluation(LaunchContext Context, LaunchReadiness View, string OperationsStamp, string FinanceStamp,
        bool Available, string? RosterRevision, string? GoodsRevision);

    public async Task<LaunchReadiness> Read(Guid id, Guid actor, CancellationToken ct) => (await Evaluate(id, actor, ct)).View;

    public async Task Confirm(Guid id, Guid actor, string section, ReadinessRequest request, CancellationToken ct)
    {
        section = section.ToUpperInvariant();
        if (section is not ("OPERATIONS" or "FINANCE")) throw new ApiException(404, "Không tìm thấy bộ phận.");
        var result = await Evaluate(id, actor, ct);
        if (!result.Context.AllowedConfirmations.Contains(section))
            throw new ApiException(403, "Bạn chưa được phân công xác nhận phần này.");
        EnsureFresh(result, request);
        if (result.Context.Started is not null || result.Context.SubmissionId is not { } submission ||
            result.View.Checks.Any(check => check.Department == section && check.Level == "BLOCK"))
            throw new ApiException(409, "Cần xử lý các mục đang chặn trước khi xác nhận bộ phận.");
        var stamp = section == "OPERATIONS" ? result.OperationsStamp : result.FinanceStamp;
        var command = new LaunchConfirmCommand(actor, request.Version, submission, section, stamp);
        await Send<object>("campaign", $"internal/campaign-launch/{id}/confirm", command, ct);
    }

    public async Task<CampaignStarted> Start(Guid id, Guid actor, ReadinessRequest request, CancellationToken ct)
    {
        var result = await Evaluate(id, actor, ct);
        if (!result.Context.CanStart) throw new ApiException(403, "Bạn chưa được phân công bắt đầu chương trình.");
        if (result.Context.Started is { } started) return started;
        EnsureFresh(result, request);
        if (!result.View.Ready || result.Context.SubmissionId is not { } submission)
            throw new ApiException(409, "Chương trình còn điều kiện phải xử lý trước khi bắt đầu.");
        var evidence = JsonSerializer.Serialize(new { result.Context.Version, result.View.ReadinessStamp, result.View.Checks, result.View.Confirmations });
        var command = new LaunchStartCommand(actor, request.Version, submission, result.OperationsStamp, result.FinanceStamp, evidence);
        var rosterPath = $"internal/launch/campaigns/{id}/roster";
        var goodsPath = $"internal/launch/campaigns/{id}/goods";
        HoldLaunchRoster? rosterHold = null;
        HoldLaunchGoods? goodsHold = null;
        try
        {
            if (result.RosterRevision is { Length: > 0 } rosterRevision)
            {
                rosterHold = new(rosterRevision, Guid.NewGuid());
                await Send<object>("volunteer", rosterPath + "/hold", rosterHold, ct);
            }
            if (result.GoodsRevision is { Length: > 0 } goodsRevision)
            {
                goodsHold = new(goodsRevision, Guid.NewGuid());
                await Send<object>("donation", goodsPath + "/hold", goodsHold, ct);
            }
            return (await Send<CampaignStarted>("campaign", $"internal/campaign-launch/{id}/start", command, ct))!;
        }
        finally
        {
            await Task.WhenAll(ReleaseHold("volunteer", rosterPath, rosterHold, id),
                ReleaseHold("donation", goodsPath, goodsHold, id));
        }
    }

    private async Task ReleaseHold(string client, string path, object? hold, Guid campaignId)
    {
        if (hold is null) return;
        using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        try { await Send<object>(client, path + "/release", hold, cleanup.Token); }
        catch (Exception ex) when (ex is ApiException or OperationCanceledException)
        { logger.LogWarning("{Service} launch hold for {CampaignId} will expire automatically.", client, campaignId); }
    }

    private async Task<Evaluation> Evaluate(Guid id, Guid actor, CancellationToken ct)
    {
        var context = (await Send<LaunchContext>("campaign", $"internal/campaign-launch/{id}/context/{actor}", null, ct))!;
        var root = $"/organizations/{context.OrganizationId}/manage";
        var campaign = $"{root}/campaigns/{id}";
        var ops = $"{root}/operations/{id}?tab=volunteers";
        var finance = $"{root}/budget/{id}?tab=donations";
        var checks = new List<ReadinessCheck>();
        if (context.SubmissionId is null)
        {
            checks.Add(new("PUBLICATION", "BLOCK", "Kế hoạch cuối chưa được duyệt và công bố.", "CAMPAIGN", campaign));
            return Build(context, checks, "", "", false);
        }
        if (context.Started is not null) return Build(context, checks, "", "", true);

        checks.Add(new("PUBLICATION", "PASS", "Đã có kế hoạch cuối công khai.", "CAMPAIGN", campaign));
        if (context.HasPendingChange)
            checks.Add(new("PENDING_CHANGE", "BLOCK", "Đề xuất đổi địa điểm đang chờ Owner quyết định.", "CAMPAIGN", campaign + "/readiness#schedule-change"));
        checks.Add(new("LEADS", context.HasActiveLeads ? "PASS" : "BLOCK",
            context.HasActiveLeads ? "Ba bộ phận có phụ trách chính đang hoạt động." : "Thiếu phụ trách chính đang hoạt động.", "CAMPAIGN", campaign));
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow,
            TimeZoneInfo.FindSystemTimeZoneById(context.Timezone)).DateTime);
        var scheduleReady = context.HasLocation && today >= context.FirstDay && today <= context.LastDay;
        checks.Add(new("SCHEDULE", scheduleReady ? "PASS" : "BLOCK", scheduleReady
            ? $"Hôm nay thuộc lịch đã duyệt ({context.Timezone})."
            : $"Cần có địa điểm hoặc hình thức trực tuyến và đúng khoảng ngày đã duyệt ({context.FirstDay:dd/MM/yyyy}–{context.LastDay:dd/MM/yyyy}).",
            "CAMPAIGN", campaign));

        var volunteerCall = context.Groups.Length > 0
            ? Source<LaunchRoster>("volunteer", $"internal/launch/campaigns/{id}/roster", ct)
            : Task.FromResult<LaunchRoster?>(new("", []));
        var donationCall = context.HasGoodsIntake
            ? Source<LaunchGoodsSnapshot>("donation", $"internal/launch/campaigns/{id}/goods", ct)
            : Task.FromResult<LaunchGoodsSnapshot?>(new("", []));
        await Task.WhenAll(volunteerCall, donationCall);
        var roster = await volunteerCall;
        var donations = await donationCall;
        if (roster is null) checks.Add(new("ROSTER_UNAVAILABLE", "BLOCK", "VolunteerService chưa phản hồi. Hãy tải lại.", "OPERATIONS", ops));
        else
        {
            foreach (var group in context.Groups.OrderBy(item => item.Id))
            {
                var count = roster.Confirmed.GetValueOrDefault(group.Id);
                checks.Add(new($"GROUP_{group.Id}", count >= group.Minimum ? "PASS" : "BLOCK",
                    $"{group.Name}: {count}/{group.Minimum} người xác nhận so với mức tối thiểu.", "OPERATIONS", ops));
            }
            if (context.Groups.Length == 0)
                checks.Add(new("NO_GROUPS", "PASS", "Kế hoạch không yêu cầu đội hình tình nguyện.", "OPERATIONS", ops));
        }

        checks.Add(new("FUNDING", context.VerifiedFunds >= context.MinimumFunds ? "PASS" : "BLOCK",
            $"Nguồn vốn đã xác nhận {context.VerifiedFunds:N0} ₫, mức tối thiểu {context.MinimumFunds:N0} ₫. Giao dịch sandbox được loại trừ.",
            "FINANCE", finance));
        if (context.HasGoodsIntake)
        {
            checks.Add(new("RECEIVER", context.HasGoodsReceiver ? "PASS" : "BLOCK",
                context.HasGoodsReceiver ? "Đã có bộ phận phụ trách điểm tiếp nhận." : "Chưa có người phụ trách điểm tiếp nhận.", "FINANCE", finance));
            if (donations is null) checks.Add(new("GOODS_UNAVAILABLE", "BLOCK", "DonationService chưa phản hồi. Hãy tải lại.", "FINANCE", finance));
            else
            {
                var open = donations.InKindTargets.Count(target => target.ReceivedQuantity < target.TargetQuantity);
                checks.Add(new("GOODS", open == 0 ? "PASS" : "WARNING", open == 0
                    ? "Các hạng mục hiện vật đã đạt." : $"Còn {open} hạng mục hiện vật chưa đủ. Kiểm tra phương án bù trong kế hoạch.", "FINANCE", finance));
            }
        }

        var operationsStamp = Hash(new { context.SubmissionId, RosterVersion = roster?.Revision });
        var financeStamp = Hash(new { context.SubmissionId, context.VerifiedFunds, context.HasGoodsReceiver,
            Goods = donations?.InKindTargets.OrderBy(target => target.BudgetItemId).Select(target => new { target.BudgetItemId, target.ReceivedQuantity }) });
        return Build(context, checks, operationsStamp, financeStamp, roster is not null && donations is not null,
            roster?.Revision, donations?.Revision);
    }

    private static Evaluation Build(LaunchContext context, List<ReadinessCheck> checks, string operations, string finance, bool available,
        string? rosterRevision = null, string? goodsRevision = null)
    {
        ReadinessConfirmation Confirmation(string section, string stamp)
        {
            var row = context.Confirmations.FirstOrDefault(item => item.Section == section);
            return new(section, stamp.Length != 0 && row?.Stamp == stamp, row?.ConfirmedAt);
        }
        ReadinessConfirmation[] sections = [Confirmation("OPERATIONS", operations), Confirmation("FINANCE", finance)];
        var stamp = Hash(new { context.SubmissionId, context.Version, operations, finance, Checks = checks.Select(check => new { check.Code, check.Level }) });
        var view = new LaunchReadiness(context.CampaignId, context.OrganizationId, context.Title, context.Version, stamp,
            context.Started is not null || available && checks.All(check => check.Level != "BLOCK") && sections.All(item => item.Current),
            context.CanStart, context.AllowedConfirmations, checks.ToArray(), sections, context.Started);
        return new(context, view, operations, finance, available, rosterRevision, goodsRevision);
    }

    private static void EnsureFresh(Evaluation result, ReadinessRequest request)
    {
        if (result.Context.SubmissionId is null) throw new ApiException(409, "Chương trình chưa có bản công bố để chốt.");
        if (!result.Available) throw new ApiException(503, "Dữ liệu bộ phận chưa sẵn sàng. Vui lòng thử lại.");
        if (request.Version != result.View.Version || request.ReadinessStamp != result.View.ReadinessStamp)
            throw new ApiException(409, "Bản sẵn sàng đã thay đổi. Vui lòng tải lại.");
    }

    private async Task<T?> Source<T>(string client, string path, CancellationToken ct) where T : class
    {
        try { return await Send<T>(client, path, null, ct); }
        catch (ApiException) { return null; }
    }

    private async Task<T?> Send<T>(string client, string path, object? body, CancellationToken ct) where T : class
    {
        try
        {
            using var message = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, path);
            if (body is not null) message.Content = JsonContent.Create(body);
            using var response = await clients.CreateClient(client).SendAsync(message, ct);
            if (response.IsSuccessStatusCode)
                return response.StatusCode == HttpStatusCode.NoContent ? null :
                    await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct) ?? throw new JsonException("Missing service response.");
            var status = (int)response.StatusCode;
            if (status is 403 or 404 or 409)
            {
                var details = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>(cancellationToken: ct);
                throw new ApiException(status, details?.Title ?? "Yêu cầu hiện không thể xử lý.");
            }
        }
        catch (Exception ex) when (!ct.IsCancellationRequested && ex is HttpRequestException or OperationCanceledException or JsonException) { }
        throw new ApiException(503, "Một dịch vụ liên quan chưa sẵn sàng. Vui lòng thử lại.");
    }

    private static string Hash<T>(T data) => Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(data)));
}
