using System.ComponentModel.DataAnnotations;
using Shared;

namespace CampaignLaunchService.Contracts;

public sealed record ReadinessCheck(string Code, string Level, string Message, string Department, string Path);
public sealed record ReadinessConfirmation(string Section, bool Current, DateTimeOffset? ConfirmedAt);
public sealed record LaunchReadiness(Guid CampaignId, Guid OrganizationId, string Title,
    string Version, string ReadinessStamp, bool Ready, bool CanStart, string[] AllowedConfirmations, ReadinessCheck[] Checks,
    ReadinessConfirmation[] Confirmations, CampaignStarted? Started);
public sealed record ReadinessRequest([Required, MaxLength(64)] string Version,
    [Required, MinLength(64), MaxLength(64)] string ReadinessStamp);
