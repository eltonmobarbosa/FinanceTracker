using FinanceTracker.Domain.Common;

namespace FinanceTracker.Domain.Categories;

/// <summary>
/// A spending/income bucket ("Alimentação", "Transporte"...). Each user has their own list.
/// Owns its rules: they are created through <see cref="AddRule"/> and deleted with the category.
/// </summary>
public sealed class Category : Entity
{
    public const int NameMaxLength = 50;

    private readonly List<CategoryRule> _rules = [];

    public Guid UserId { get; private set; }
    public string Name { get; private set; } = null!;

    /// <summary>
    /// Money moved between the user's own accounts (e.g. paying the credit card bill from the checking account).
    /// Reports ignore it, otherwise the same money would count as an expense twice.
    /// </summary>
    public bool IsTransfer { get; private set; }

    public IReadOnlyCollection<CategoryRule> Rules => _rules;

    private Category() { } // EF Core materialization

    public Category(Guid userId, string name, bool isTransfer = false)
    {
        if (userId == Guid.Empty) throw new ArgumentException("User is required.", nameof(userId));

        UserId = userId;
        Update(name, isTransfer);
    }

    public void Update(string name, bool isTransfer)
    {
        Name = Text.Required(name, NameMaxLength, nameof(name));
        IsTransfer = isTransfer;
    }

    public CategoryRule AddRule(string pattern, int priority = 0)
    {
        var rule = new CategoryRule(Id, pattern, priority);
        _rules.Add(rule);
        return rule;
    }
}
