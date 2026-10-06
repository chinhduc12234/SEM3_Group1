using CatalogService.DTOs;
using CatalogService.Models;
using CatalogService.Repositories;
using Shared;

namespace CatalogService.Services;

public sealed class ProductService(IProductRepository products)
{
    private static ProductDto ToDto(Product p) => new(p.Id, p.Name, p.Description, p.Category, p.Price, p.IsPublished);
    public async Task<PageResult<ProductDto>> List(PageQuery query, bool admin)
    {
        var page = await products.List(query, admin);
        return new(page.Items.Select(ToDto).ToList(), page.TotalCount, page.Page, page.PageSize);
    }
    public async Task<ProductDto> Get(Guid id, bool admin)
    {
        var product = await Find(id);
        if (!product.IsPublished && !admin) throw new ApiException(404, "Không tìm thấy sản phẩm.");
        return ToDto(product);
    }
    public async Task<ProductDto> Save(Guid? id, ProductRequest request)
    {
        var product = id.HasValue ? await Find(id.Value) : new Product();
        product.Name = request.Name.Trim(); product.Description = request.Description.Trim();
        product.Category = request.Category.Trim(); product.Price = request.Price; product.IsPublished = request.IsPublished;
        if (product.Name.Length < 2 || product.Description.Length == 0 || product.Category.Length == 0) throw new ApiException(400, "Vui lòng nhập đầy đủ thông tin.");
        if (!id.HasValue) products.Add(product);
        await products.Save();
        return ToDto(product);
    }
    public async Task Delete(Guid id) { products.Delete(await Find(id)); await products.Save(); }
    private async Task<Product> Find(Guid id) => await products.Get(id) ?? throw new ApiException(404, "Không tìm thấy sản phẩm.");
}
