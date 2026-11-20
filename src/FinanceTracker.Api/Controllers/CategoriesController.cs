using FinanceTracker.Application.Categories;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[ApiController]
[Route("api/categories")]
public sealed class CategoriesController(CategoryService categories) : ControllerBase
{
    [HttpGet]
    public Task<List<CategoryDto>> List(CancellationToken ct) => categories.ListAsync(ct);

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create(SaveCategoryRequest request, CancellationToken ct) =>
        Created("api/categories", await categories.CreateAsync(request, ct));

    [HttpPut("{id:int}")]
    public Task<CategoryDto> Update(int id, SaveCategoryRequest request, CancellationToken ct) =>
        categories.UpdateAsync(id, request, ct);

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await categories.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:int}/rules")]
    public async Task<ActionResult<CategoryRuleDto>> AddRule(int id, CreateRuleRequest request, CancellationToken ct) =>
        Created("api/categories", await categories.AddRuleAsync(id, request, ct));

    [HttpDelete("rules/{ruleId:int}")]
    public async Task<IActionResult> DeleteRule(int ruleId, CancellationToken ct)
    {
        await categories.DeleteRuleAsync(ruleId, ct);
        return NoContent();
    }
}
