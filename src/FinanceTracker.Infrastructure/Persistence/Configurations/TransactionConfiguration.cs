using FinanceTracker.Domain.Accounts;
using FinanceTracker.Domain.Categories;
using FinanceTracker.Domain.Transactions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.Property(t => t.Description).HasMaxLength(Transaction.DescriptionMaxLength);
        builder.Property(t => t.ExternalId).HasMaxLength(Transaction.ExternalIdMaxLength);

        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(t => t.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // NoAction in the database: SQL Server rejects two cascade paths reaching the same table
        // (user -> account -> transaction and user -> category -> transaction, once users exist in phase 5).
        // The application clears CategoryId before deleting a category.
        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.ClientSetNull);

        // Idempotent import: the database itself refuses the same bank transaction twice in one account,
        // even if two imports run at the same time.
        builder.HasIndex(t => new { t.AccountId, t.ExternalId }).IsUnique();

        // Statement listing and monthly reports filter by account and period.
        builder.HasIndex(t => new { t.AccountId, t.Date });
    }
}
