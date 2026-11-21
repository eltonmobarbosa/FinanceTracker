using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Accounts;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Application.Reports;

/// <param name="CategoryId">null = uncategorized.</param>
public sealed record CategoryTotal(int? CategoryId, string Name, decimal Total);

public sealed record MonthTotal(int Year, int Month, decimal Income, decimal Expenses);

/// <summary>Expenses are reported as positive numbers ("spent R$ 100"), income too.</summary>
public sealed record SummaryDto(
    decimal Income, decimal Expenses, IReadOnlyList<CategoryTotal> ExpensesByCategory, IReadOnlyList<MonthTotal> ByMonth);

public sealed class ReportService(IAppDbContext db, ICurrentUser user)
{
    public async Task<SummaryDto> GetSummaryAsync(DateOnly? from, DateOnly? to, int? accountId, CancellationToken ct)
    {
        var userId = user.UserId;

        // Transfers between the user's own accounts (credit card bill payment) are not income nor expense.
        var transactions = db.OwnedTransactions(userId)
            .Where(t => t.CategoryId == null || !db.Categories.Any(c => c.Id == t.CategoryId && c.IsTransfer));

        if (from is { } f) transactions = transactions.Where(t => t.Date >= f);
        if (to is { } tt) transactions = transactions.Where(t => t.Date <= tt);
        if (accountId is { } a) transactions = transactions.Where(t => t.AccountId == a);

        // On a card, money coming back is a refund: it reduces spending instead of counting as income.
        var flows =
            from t in transactions
            join acc in db.Accounts on t.AccountId equals acc.Id
            select new { t.CategoryId, t.Date, t.Amount, acc.Type };

        // Aggregations run in SQL Server (GROUP BY / SUM); only the totals travel to the app.
        var byCategory = await flows
            .Where(t => t.Amount < 0 || t.Type == AccountType.CreditCard)
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Total = -g.Sum(t => t.Amount) })
            .ToListAsync(ct);

        // Anonymous type in the SQL part; the record is built in memory (EF cannot order by a record's properties).
        var byMonth = (await flows
                .GroupBy(t => new { t.Date.Year, t.Date.Month })
                .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                .Select(g => new
                {
                    g.Key.Year,
                    g.Key.Month,
                    Income = g.Sum(t => t.Amount > 0 && t.Type != AccountType.CreditCard ? t.Amount : 0),
                    Expenses = -g.Sum(t => t.Amount < 0 || t.Type == AccountType.CreditCard ? t.Amount : 0),
                })
                .ToListAsync(ct))
            // A refund of a purchase from an earlier month must not show as negative spending.
            .Select(m => new MonthTotal(m.Year, m.Month, m.Income, Math.Max(0, m.Expenses)))
            .ToList();

        var names = await db.OwnedCategories(userId).ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        var expensesByCategory = byCategory
            .Where(c => c.Total > 0)
            .Select(c => new CategoryTotal(
                c.CategoryId, c.CategoryId is { } id ? names[id] : "Sem categoria", c.Total))
            .OrderByDescending(c => c.Total)
            .ToList();

        return new SummaryDto(
            byMonth.Sum(m => m.Income), byMonth.Sum(m => m.Expenses), expensesByCategory, byMonth);
    }
}
