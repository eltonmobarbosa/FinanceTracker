using System.Globalization;
using FinanceTracker.Domain.Common;

namespace FinanceTracker.Domain.Categories;

/// <summary>
/// "If the description contains <see cref="Pattern"/>, the transaction belongs to <see cref="CategoryId"/>."
/// When several rules match, the one with the highest <see cref="Priority"/> wins.
/// </summary>
public sealed class CategoryRule : Entity
{
    public const int PatternMaxLength = 100;

    public int CategoryId { get; private set; }
    public string Pattern { get; private set; } = null!;
    public int Priority { get; private set; }

    private CategoryRule() { } // EF Core materialization

    public CategoryRule(int categoryId, string pattern, int priority = 0)
    {
        CategoryId = categoryId;
        Pattern = Text.Required(pattern, PatternMaxLength, nameof(pattern));
        Priority = priority;
    }

    // Bank descriptions vary in case and accents ("PADARIA SÃO JOÃO" vs "Padaria Sao Joao"), so both are ignored.
    public bool Matches(string description) =>
        CultureInfo.InvariantCulture.CompareInfo.IndexOf(
            description, Pattern, CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace) >= 0;
}
