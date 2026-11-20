using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using FinanceTracker.Application.Statements;

namespace FinanceTracker.Infrastructure.Statements;

/// <summary>
/// OFX (Open Financial Exchange), the format most banks export. Two flavors exist:
/// v1 is SGML, where leaf tags are not closed (<c>&lt;TRNAMT&gt;-50.00</c>), so it is not valid XML;
/// v2 is XML (<c>&lt;TRNAMT&gt;-50.00&lt;/TRNAMT&gt;</c>). Reading each tag's value up to the next '&lt;' or line
/// break handles both, so no XML parser is used.
/// Amounts are already signed (negative = debit) for checking accounts and credit cards.
/// </summary>
public sealed partial class OfxParser : IStatementParser
{
    static OfxParser() =>
        // Windows-1252 is not built into .NET Core; Brazilian banks often declare CHARSET:1252.
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

    public bool CanParse(string fileName, byte[] content) =>
        fileName.EndsWith(".ofx", StringComparison.OrdinalIgnoreCase) &&
        Decode(content).Contains("<OFX>", StringComparison.OrdinalIgnoreCase);

    public IReadOnlyList<ParsedTransaction> Parse(byte[] content)
    {
        var text = Decode(content);
        if (!text.Contains("<OFX>", StringComparison.OrdinalIgnoreCase))
            throw new StatementFormatException("Arquivo OFX inválido: tag <OFX> não encontrada.");

        var ids = new ExternalIds();
        var transactions = new List<ParsedTransaction>();
        var index = 0;

        foreach (Match block in TransactionBlock().Matches(text))
        {
            index++;
            var tags = ReadTags(block.Groups[1].Value);

            var fitId = Required(tags, "FITID", index);
            var date = ParseDate(Required(tags, "DTPOSTED", index), index);
            var amount = ParseAmount(Required(tags, "TRNAMT", index), index);
            var description = tags.GetValueOrDefault("MEMO") ?? tags.GetValueOrDefault("NAME")
                ?? throw new StatementFormatException($"Transação {index}: sem MEMO nem NAME.");

            // FITID should be unique, but some banks repeat it inside one file.
            transactions.Add(new ParsedTransaction(date, amount, description, ids.Unique(fitId)));
        }

        return transactions;
    }

    private static Dictionary<string, string> ReadTags(string block)
    {
        var tags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match tag in LeafTag().Matches(block))
        {
            var value = tag.Groups[2].Value.Trim();
            if (value.Length > 0) tags.TryAdd(tag.Groups[1].Value, value);
        }
        return tags;
    }

    private static string Required(Dictionary<string, string> tags, string name, int index) =>
        tags.GetValueOrDefault(name) ?? throw new StatementFormatException($"Transação {index}: tag <{name}> ausente.");

    // DTPOSTED is YYYYMMDD optionally followed by time and timezone: "20261016120000[-3:BRT]".
    private static DateOnly ParseDate(string value, int index) =>
        value.Length >= 8 && DateOnly.TryParseExact(value[..8], "yyyyMMdd", CultureInfo.InvariantCulture,
            DateTimeStyles.None, out var date)
            ? date
            : throw new StatementFormatException($"Transação {index}: data inválida '{value}'.");

    // The spec uses '.', but some Brazilian banks write "-50,00".
    private static decimal ParseAmount(string value, int index)
    {
        var normalized = value.Contains('.') ? value : value.Replace(',', '.');
        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount)
            ? amount
            : throw new StatementFormatException($"Transação {index}: valor inválido '{value}'.");
    }

    /// <summary>The SGML header declares the charset (CHARSET:1252); otherwise UTF-8.</summary>
    private static string Decode(byte[] content)
    {
        var header = Encoding.ASCII.GetString(content, 0, Math.Min(content.Length, 512));
        var encoding = header.Contains("CHARSET:1252", StringComparison.OrdinalIgnoreCase)
            ? Encoding.GetEncoding(1252)
            : Encoding.UTF8;

        using var reader = new StreamReader(new MemoryStream(content), encoding, detectEncodingFromByteOrderMarks: true);
        return reader.ReadToEnd();
    }

    [GeneratedRegex(@"<STMTTRN>(.*?)</STMTTRN>", RegexOptions.Singleline | RegexOptions.IgnoreCase)]
    private static partial Regex TransactionBlock();

    // <TAG>value  — value stops at the next tag or line break (works for SGML and XML).
    [GeneratedRegex(@"<(\w+)>([^<\r\n]*)")]
    private static partial Regex LeafTag();
}
