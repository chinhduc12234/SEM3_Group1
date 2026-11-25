using System.ComponentModel.DataAnnotations;

namespace CampaignService.Contracts;

public sealed record ScheduleChangeRequest([Required] string Version, Guid DayId, Guid ActivityId,
    [Required, StringLength(400, MinimumLength = 5)] string Location,
    [Required, StringLength(1000, MinimumLength = 5)] string Reason);
public sealed record ScheduleChangeDecision([Required] string Version, Guid ChangeId, bool Approve,
    [Required, StringLength(1000, MinimumLength = 3)] string Note);
public sealed record ScheduleChangeSlot(Guid DayId, Guid ActivityId, DateOnly Date, string Activity, string Location);
public sealed record ScheduleChangeProposal(Guid Id, Guid SubmissionId, Guid RequestedBy, DateTimeOffset RequestedAt,
    ScheduleChangeSlot Before, string NewLocation, string Reason);
public sealed record ScheduleChangeView(string Version, bool CanRequest, bool CanDecide,
    ScheduleChangeSlot[] Slots, ScheduleChangeProposal? Pending);
