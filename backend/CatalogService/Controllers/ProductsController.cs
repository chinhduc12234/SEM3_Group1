using CatalogService.DTOs;
using CatalogService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared;

namespace CatalogService.Controllers;

[ApiController, Route("api/products")]
public sealed class ProductsController(ProductService products) : ControllerBase
{
    [HttpGet] public Task<PageResult<ProductDto>> List([FromQuery] PageQuery query) => products.List(query, User.IsInRole("Admin"));
    [HttpGet("{id:guid}")] public Task<ProductDto> Get(Guid id) => products.Get(id, User.IsInRole("Admin"));
    [Authorize(Roles = "Admin"), HttpPost]
    public async Task<IActionResult> Create(ProductRequest request)
    {
        var product = await products.Save(null, request);
        return CreatedAtAction(nameof(Get), new { id = product.Id }, product);
    }
    [Authorize(Roles = "Admin"), HttpPut("{id:guid}")] public Task<ProductDto> Update(Guid id, ProductRequest request) => products.Save(id, request);
    [Authorize(Roles = "Admin"), HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id) { await products.Delete(id); return NoContent(); }
}
