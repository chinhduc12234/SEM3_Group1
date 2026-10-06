using System.ComponentModel.DataAnnotations;

namespace CatalogService.DTOs;

public sealed record ProductRequest(
    [Required, StringLength(160, MinimumLength = 2)] string Name,
    [Required, StringLength(2000)] string Description,
    [Required, StringLength(80)] string Category,
    [Range(typeof(decimal), "0", "999999999999")] decimal Price, bool IsPublished);
public sealed record ProductDto(Guid Id, string Name, string Description, string Category, decimal Price, bool IsPublished);
