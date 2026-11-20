using FinanceTracker.Domain.Common;

namespace FinanceTracker.Domain.Categories;

/// <summary>A spending/income bucket ("Alimentação", "Transporte"...). Each user has their own list.</summary>
public sealed class Category : Entity
{
    public const int NameMaxLength = 50;

    public Guid UserId { get; private set; }
    public string Name { get; private set; } = null!;

    private Category() { } // EF Core materialization

    public Category(Guid userId, string name)
    {
        if (userId == Guid.Empty) throw new ArgumentException("User is required.", nameof(userId));

        UserId = userId;
        Name = Text.Required(name, NameMaxLength, nameof(name));
    }

    public void Rename(string name) => Name = Text.Required(name, NameMaxLength, nameof(name));
}
