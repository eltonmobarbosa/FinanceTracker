using FinanceTracker.Domain.Accounts;
using FinanceTracker.Domain.Categories;
using FinanceTracker.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Application.Common;

/// <summary>
/// What the use cases need from the database. Implemented by AppDbContext in Infrastructure.
/// DbSet is already a repository and DbContext a unit of work, so no extra repository layer (ADR 0001).
/// </summary>
public interface IAppDbContext
{
    DbSet<Account> Accounts { get; }
    DbSet<Category> Categories { get; }
    DbSet<CategoryRule> CategoryRules { get; }
    DbSet<Transaction> Transactions { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

/// <summary>The logged-in user. Implemented by the Api from the JWT "sub" claim.</summary>
public interface ICurrentUser
{
    Guid UserId { get; }
}
