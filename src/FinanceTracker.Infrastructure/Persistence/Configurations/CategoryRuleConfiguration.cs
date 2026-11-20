using FinanceTracker.Domain.Categories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class CategoryRuleConfiguration : IEntityTypeConfiguration<CategoryRule>
{
    // The relationship with Category is configured in CategoryConfiguration (the owner side).
    public void Configure(EntityTypeBuilder<CategoryRule> builder) =>
        builder.Property(r => r.Pattern).HasMaxLength(CategoryRule.PatternMaxLength);
}
