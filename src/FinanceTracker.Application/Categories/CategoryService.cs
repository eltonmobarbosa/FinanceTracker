using System.ComponentModel.DataAnnotations;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Categories;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Application.Categories;

public sealed record CategoryRuleDto(int Id, string Pattern, int Priority);

public sealed record CategoryDto(int Id, string Name, bool IsTransfer, IReadOnlyList<CategoryRuleDto> Rules);

public sealed record SaveCategoryRequest(
    [Required, StringLength(Category.NameMaxLength)] string Name,
    bool IsTransfer = false);

public sealed record CreateRuleRequest(
    [Required, StringLength(CategoryRule.PatternMaxLength)] string Pattern,
    [Range(0, 100)] int Priority = 0);

public sealed class CategoryService(IAppDbContext db, ICurrentUser user)
{
    public async Task<List<CategoryDto>> ListAsync(CancellationToken ct)
    {
        var categories = await db.OwnedCategories(user.UserId)
            .Include(c => c.Rules)
            .OrderBy(c => c.Name)
            .AsNoTracking()
            .ToListAsync(ct);

        return categories.Select(ToDto).ToList();
    }

    public async Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken ct)
    {
        await EnsureNameIsFreeAsync(request.Name, exceptId: null, ct);

        var category = new Category(user.UserId, request.Name, request.IsTransfer);
        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);
        return ToDto(category);
    }

    public async Task<CategoryDto> UpdateAsync(int id, SaveCategoryRequest request, CancellationToken ct)
    {
        var category = await db.OwnedCategories(user.UserId).Include(c => c.Rules).GetAsync(id, "Categoria", ct);
        await EnsureNameIsFreeAsync(request.Name, exceptId: id, ct);

        category.Update(request.Name, request.IsTransfer);
        await db.SaveChangesAsync(ct);
        return ToDto(category);
    }

    /// <summary>Transactions of the category become uncategorized; its rules are deleted.</summary>
    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var category = await db.OwnedCategories(user.UserId).GetAsync(id, "Categoria", ct);

        // The FK is NO ACTION in the database (ADR 0005), so clear it here. Same SaveChanges = same
        // database transaction: either both happen or neither does.
        var transactions = await db.Transactions.Where(t => t.CategoryId == id).ToListAsync(ct);
        transactions.ForEach(t => t.Categorize(null));

        db.Categories.Remove(category);
        await db.SaveChangesAsync(ct);
    }

    public async Task<CategoryRuleDto> AddRuleAsync(int categoryId, CreateRuleRequest request, CancellationToken ct)
    {
        var category = await db.OwnedCategories(user.UserId).GetAsync(categoryId, "Categoria", ct);
        await db.EnsureRuleIsNewAsync(user.UserId, request.Pattern, ct);

        var rule = category.AddRule(request.Pattern, request.Priority);
        await db.SaveChangesAsync(ct);
        return new CategoryRuleDto(rule.Id, rule.Pattern, rule.Priority);
    }

    public async Task DeleteRuleAsync(int ruleId, CancellationToken ct)
    {
        var rule = await db.OwnedRules(user.UserId).GetAsync(ruleId, "Regra", ct);
        db.CategoryRules.Remove(rule);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Gives a new user a starting set of categories and rules (called once, at registration).</summary>
    public async Task SeedDefaultsAsync(Guid userId, CancellationToken ct)
    {
        foreach (var (name, isTransfer, rules) in DefaultCategories.All)
        {
            var category = new Category(userId, name, isTransfer);
            foreach (var (pattern, priority) in rules) category.AddRule(pattern, priority);
            db.Categories.Add(category);
        }

        await db.SaveChangesAsync(ct);
    }

    // The unique index (UserId, Name) is the real guarantee; this check gives a friendly message.
    private async Task EnsureNameIsFreeAsync(string name, int? exceptId, CancellationToken ct)
    {
        var trimmed = name.Trim();
        if (await db.OwnedCategories(user.UserId).AnyAsync(c => c.Name == trimmed && c.Id != exceptId, ct))
            throw new ConflictException($"Já existe uma categoria chamada \"{trimmed}\".");
    }

    private static CategoryDto ToDto(Category c) => new(
        c.Id, c.Name, c.IsTransfer,
        c.Rules.OrderByDescending(r => r.Priority).ThenBy(r => r.Pattern)
            .Select(r => new CategoryRuleDto(r.Id, r.Pattern, r.Priority)).ToList());
}
