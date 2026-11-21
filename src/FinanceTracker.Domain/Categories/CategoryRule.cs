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

    /// <summary>"Pagamento recebido" is a bill payment only on a card; on a checking account it is real income.</summary>
    public bool IsCardOnly => HasSamePattern("pagamento recebido");

    // Bank descriptions vary in case and accents ("PADARIA SÃO JOÃO" vs "Padaria Sao Joao"), so both are ignored.
    // The pattern must start a word: "posto" matches "POSTO SHELL" but not "IMPOSTO", and "mercado" still
    // matches "MERCADOS". Digits count as a boundary because banks glue them to names ("1234UBER").
    public bool Matches(string description)
    {
        var text = description.AsSpan();
        for (var from = 0; from < text.Length;)
        {
            var index = CultureInfo.InvariantCulture.CompareInfo.IndexOf(text[from..], Pattern, IgnoreCaseAndAccents, out _);
            if (index < 0) return false;

            var start = from + index;
            if (start == 0 || !char.IsLetter(text[start - 1])) return true;
            from = start + 1;
        }
        return false;
    }

    public bool HasSamePattern(string pattern) =>
        CultureInfo.InvariantCulture.CompareInfo.Compare(Pattern, pattern.Trim(), IgnoreCaseAndAccents) == 0;

    private const CompareOptions IgnoreCaseAndAccents = CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace;
}
