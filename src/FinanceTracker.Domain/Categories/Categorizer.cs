namespace FinanceTracker.Domain.Categories;

/// <summary>
/// Picks the category for a description from a user's rules.
/// Precedence: higher <see cref="CategoryRule.Priority"/> first; on a tie, the longer (more specific) pattern wins,
/// so "mercado livre" beats "mercado" without the user having to set priorities.
/// </summary>
public sealed class Categorizer(IEnumerable<CategoryRule> rules)
{
    // Sorted once; Categorize runs for every line of a statement.
    private readonly CategoryRule[] _rules = rules
        .OrderByDescending(r => r.Priority)
        .ThenByDescending(r => r.Pattern.Length)
        .ToArray();

    public int? Categorize(string description) =>
        _rules.FirstOrDefault(r => r.Matches(description))?.CategoryId;
}
