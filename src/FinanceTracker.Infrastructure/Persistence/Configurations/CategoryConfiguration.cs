using FinanceTracker.Domain.Categories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.Property(c => c.Name).HasMaxLength(Category.NameMaxLength);

        // A user cannot have two categories with the same name. Also serves "list my categories" queries.
        builder.HasIndex(c => new { c.UserId, c.Name }).IsUnique();
    }
}
