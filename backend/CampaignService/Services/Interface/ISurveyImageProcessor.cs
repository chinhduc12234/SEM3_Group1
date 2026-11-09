using CampaignService.Contracts;
using CampaignService.Data;

namespace CampaignService.Services;

public interface ISurveyImageProcessor
{
    Task<byte[]> Process(IFormFile file, CancellationToken ct);
}
