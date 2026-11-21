using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace FinanceTracker.Infrastructure.Statements;

/// <summary>
/// Builds the ExternalId used for idempotent imports. One instance per file being parsed.
/// </summary>
internal sealed class ExternalIds
{
    private readonly Dictionary<string, int> _seen = new(StringComparer.Ordinal);

    /// <summary>
    /// Makes a key unique inside the file: the 2nd identical key becomes "key#1", the 3rd "key#2"...
    /// Two real purchases with the same date, value and description are both kept, and parsing the
    /// same file again yields the same ids, so re-imports are still detected.
    /// </summary>
    public string Unique(string key)
    {
        var occurrence = _seen.GetValueOrDefault(key);
        _seen[key] = occurrence + 1;
        return occurrence == 0 ? key : $"{key}#{occurrence}";
    }

    /// <summary>
    /// OFX: some banks reuse a FITID for different transactions, so the id alone would hide the new one as
    /// "already imported". Date and amount tell them apart.
    /// </summary>
    public static string Ofx(string fitId, DateOnly date, decimal amount) =>
        string.Create(CultureInfo.InvariantCulture, $"{fitId}~{date:yyyyMMdd}~{amount:F2}");

    /// <summary>For formats without a bank id (CSV): SHA-256 of the line's content, 64 hex chars.</summary>
    public static string Hash(DateOnly date, decimal amount, string description)
    {
        var key = string.Join('|',
            date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            amount.ToString(CultureInfo.InvariantCulture),
            description);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
    }
}
