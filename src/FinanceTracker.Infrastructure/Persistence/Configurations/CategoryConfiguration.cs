using FinanceTracker.Domain.Categories;
using Microsoft.AspNetCore.Identity;
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

        builder.HasOne<IdentityUser<Guid>>()
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // A rule only makes sense with its category: deleting the category deletes its rules.
        // EF writes the private _rules list directly (the public Rules property is read-only).
        builder.HasMany(c => c.Rules)
            .WithOne()
            .HasForeignKey(r => r.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(c => c.Rules).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
