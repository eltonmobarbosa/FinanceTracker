namespace FinanceTracker.Domain.Common;

/// <summary>String guard shared by every entity, so "required + trimmed + max length" is written once.</summary>
public static class Text
{
    public static string Required(string? value, int maxLength, string paramName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, paramName);

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"Must have at most {maxLength} characters.", paramName);

        return trimmed;
    }
}
