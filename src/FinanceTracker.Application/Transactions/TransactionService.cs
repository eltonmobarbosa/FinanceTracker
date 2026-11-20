using System.ComponentModel.DataAnnotations;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Categories;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Application.Transactions;

public sealed record TransactionDto(
    int Id, DateOnly Date, decimal Amount, string Description,
    int AccountId, string AccountName, int? CategoryId, string? CategoryName);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

/// <summary>Filters for the transaction list. Every field is optional.</summary>
public sealed class TransactionQuery
{
    public int? AccountId { get; init; }
    public int? CategoryId { get; init; }
    public bool Uncategorized { get; init; }
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }
    [StringLength(100)] public string? Search { get; init; }
    [Range(1, int.MaxValue)] public int Page { get; init; } = 1;
    [Range(1, 200)] public int PageSize { get; init; } = 50;
}

/// <param name="CategoryId">null = remove the category.</param>
/// <param name="RulePattern">
/// When set, also creates the rule "description contains RulePattern -> CategoryId" and applies it
/// to the user's uncategorized transactions. This is how the categorization "learns".
/// </param>
public sealed record CategorizeRequest(
    int? CategoryId,
    [StringLength(CategoryRule.PatternMaxLength)] string? RulePattern = null);

/// <param name="AlsoCategorized">Other uncategorized transactions the new rule matched.</param>
public sealed record CategorizeResult(int AlsoCategorized);

public sealed class TransactionService(IAppDbContext db, ICurrentUser user)
{
    public async Task<PagedResult<TransactionDto>> SearchAsync(TransactionQuery query, CancellationToken ct)
    {
        var transactions = db.OwnedTransactions(user.UserId);

        if (query.AccountId is { } accountId) transactions = transactions.Where(t => t.AccountId == accountId);
        if (query.CategoryId is { } categoryId) transactions = transactions.Where(t => t.CategoryId == categoryId);
        if (query.Uncategorized) transactions = transactions.Where(t => t.CategoryId == null);
        if (query.From is { } from) transactions = transactions.Where(t => t.Date >= from);
        if (query.To is { } to) transactions = transactions.Where(t => t.Date <= to);
        if (!string.IsNullOrWhiteSpace(query.Search))
            transactions = transactions.Where(t => t.Description.Contains(query.Search.Trim()));

        var total = await transactions.CountAsync(ct);

        var items = await (
                from t in transactions
                join a in db.Accounts on t.AccountId equals a.Id
                join c in db.Categories on t.CategoryId equals c.Id into categories
                from c in categories.DefaultIfEmpty()
                orderby t.Date descending, t.Id descending
                select new TransactionDto(
                    t.Id, t.Date, t.Amount, t.Description, a.Id, a.Name, t.CategoryId, c == null ? null : c.Name))
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(ct);

        return new PagedResult<TransactionDto>(items, query.Page, query.PageSize, total);
    }

    public async Task<CategorizeResult> CategorizeAsync(int id, CategorizeRequest request, CancellationToken ct)
    {
        var transaction = await db.OwnedTransactions(user.UserId).GetAsync(id, "Transação", ct);

        if (request.CategoryId is not { } categoryId)
        {
            transaction.Categorize(null);
            await db.SaveChangesAsync(ct);
            return new CategorizeResult(0);
        }

        var category = await db.OwnedCategories(user.UserId).GetAsync(categoryId, "Categoria", ct);
        transaction.Categorize(category.Id);

        var alsoCategorized = 0;
        if (!string.IsNullOrWhiteSpace(request.RulePattern))
        {
            var rule = category.AddRule(request.RulePattern);

            // Matched in memory with the same Matches() used at import time (accent-insensitive), so the
            // result is identical to importing again. shortcut: loads all uncategorized rows of the user;
            // fine for personal volumes, move to a set-based SQL update if it grows to hundreds of thousands.
            var uncategorized = await db.OwnedTransactions(user.UserId)
                .Where(t => t.CategoryId == null && t.Id != transaction.Id)
                .ToListAsync(ct);

            foreach (var other in uncategorized.Where(t => rule.Matches(t.Description)))
            {
                other.Categorize(category.Id);
                alsoCategorized++;
            }
        }

        await db.SaveChangesAsync(ct);
        return new CategorizeResult(alsoCategorized);
    }
}
