using System.ComponentModel.DataAnnotations;

namespace Shared;

public sealed class PageQuery
{
    [Range(1, 100000)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 10;
    [StringLength(100)] public string? Search { get; set; }
}
public sealed record PageResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
