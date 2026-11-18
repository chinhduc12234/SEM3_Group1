namespace CampaignService.Contracts;

public sealed record ActivityPhotoReport(Guid Id, Guid ActivityId, string ActivityTitle, string DayTitle,
    DateOnly? DayDate, string Sender, string Note, DateTimeOffset SentAt);
