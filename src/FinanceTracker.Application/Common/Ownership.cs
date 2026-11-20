using FinanceTracker.Domain.Accounts;
using FinanceTracker.Domain.Categories;
using FinanceTracker.Domain.Common;
using FinanceTracker.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Application.Common;

/// <summary>
/// Multi-user isolation in one place: every query a use case runs starts from one of these filters,
/// so "only the logged-in user's data" is not re-written (and possibly forgotten) in each query.
/// </summary>
internal static class Ownership
{
    public static IQueryable<Account> OwnedAccounts(this IAppDbContext db, Guid userId) =>
        db.Accounts.Where(a => a.UserId == userId);

    public static IQueryable<Category> OwnedCategories(this IAppDbContext db, Guid userId) =>
        db.Categories.Where(c => c.UserId == userId);

    public static IQueryable<CategoryRule> OwnedRules(this IAppDbContext db, Guid userId) =>
        db.CategoryRules.Where(r => db.Categories.Any(c => c.Id == r.CategoryId && c.UserId == userId));

    public static IQueryable<Transaction> OwnedTransactions(this IAppDbContext db, Guid userId) =>
        db.Transactions.Where(t => db.Accounts.Any(a => a.Id == t.AccountId && a.UserId == userId));

    public static async Task<T> GetAsync<T>(this IQueryable<T> query, int id, string resource, CancellationToken ct)
        where T : Entity =>
        await query.FirstOrDefaultAsync(e => e.Id == id, ct) ?? throw new NotFoundException(resource);
}
