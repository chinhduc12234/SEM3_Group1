namespace OrganizationService.Contracts;

public sealed record OrganizationUpload(string FileName, long Length, Func<Stream> OpenReadStream);
