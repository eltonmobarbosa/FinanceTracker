using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Accounts;
using FinanceTracker.Domain.Categories;
using FinanceTracker.Domain.Transactions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence;

/// <summary>
/// One database for the app tables and the ASP.NET Identity tables (AspNetUsers...), so user ids can be
/// foreign keys and registration + default categories can share one transaction.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<IdentityUser<Guid>, IdentityRole<Guid>, Guid>(options), IAppDbContext
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CategoryRule> CategoryRules => Set<CategoryRule>();
    public DbSet<Transaction> Transactions => Set<Transaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder); // Identity tables

        // Picks up every IEntityTypeConfiguration<T> in this assembly (one file per table).
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder) =>
        // Money: every decimal is decimal(18,2), declared once instead of per property.
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
}
