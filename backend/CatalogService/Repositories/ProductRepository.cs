using CatalogService.Data;
using CatalogService.Models;
using Microsoft.EntityFrameworkCore;
using Shared;

namespace CatalogService.Repositories;

public interface IProductRepository
{
    Task<PageResult<Product>> List(PageQuery query, bool includeDrafts);
    Task<Product?> Get(Guid id);
    void Add(Product product);
    void Delete(Product product);
    Task Save();
}
public sealed class ProductRepository(CatalogDbContext db) : IProductRepository
{
    public async Task<PageResult<Product>> List(PageQuery query, bool includeDrafts)
    {
        var products = db.Products.AsNoTracking().Where(x => includeDrafts || x.IsPublished);
        if (!string.IsNullOrWhiteSpace(query.Search)) products = products.Where(x => x.Name.Contains(query.Search) || x.Category.Contains(query.Search));
        var total = await products.CountAsync();
        var items = await products.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync();
        return new(items, total, query.Page, query.PageSize);
    }
    public Task<Product?> Get(Guid id) => db.Products.FindAsync(id).AsTask();
    public void Add(Product product) => db.Products.Add(product);
    public void Delete(Product product) => db.Products.Remove(product);
    public Task Save() => db.SaveChangesAsync();
}
