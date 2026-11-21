using System.Globalization;
using System.Net;
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

        foreach (var block in TransactionBlocks(text))
        {
            index++;
            var tags = ReadTags(block);

            var fitId = Required(tags, "FITID", index);
            var date = ParseDate(Required(tags, "DTPOSTED", index), index);
            var amount = ParseAmount(Required(tags, "TRNAMT", index), index);
            var description = tags.GetValueOrDefault("MEMO") ?? tags.GetValueOrDefault("NAME")
                ?? throw new StatementFormatException($"Transação {index}: sem MEMO nem NAME.");

            // FITID should be unique, but some banks repeat it, inside one file or across files.
            transactions.Add(new ParsedTransaction(date, amount, description, ids.Unique(ExternalIds.Ofx(fitId, date, amount))));
        }

        return transactions;
    }

    // IndexOf instead of a regex: a file full of unclosed tags stays linear and cannot pin the CPU.
    private static IEnumerable<string> TransactionBlocks(string text)
    {
        const string open = "<STMTTRN>", close = "</STMTTRN>";

        var start = text.IndexOf(open, StringComparison.OrdinalIgnoreCase);
        while (start >= 0)
        {
            var body = start + open.Length;
            var end = text.IndexOf(close, body, StringComparison.OrdinalIgnoreCase);
            if (end < 0) yield break;

            yield return text[body..end];
            start = text.IndexOf(open, end + close.Length, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static Dictionary<string, string> ReadTags(string block)
    {
        var tags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match tag in LeafTag().Matches(block))
        {
            var value = WebUtility.HtmlDecode(tag.Groups[2].Value).Trim(); // "C&amp;A" -> "C&A"
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

    // The spec uses '.', but some Brazilian banks write "-50,00" or "-1.234,56": a comma after the last dot is decimal.
    private static decimal ParseAmount(string value, int index)
    {
        var normalized = value.LastIndexOf(',') > value.LastIndexOf('.')
            ? value.Replace(".", "").Replace(',', '.')
            : value;
        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount)
            ? amount
            : throw new StatementFormatException($"Transação {index}: valor inválido '{value}'.");
    }

    /// <summary>
    /// The SGML header may declare CHARSET:1252. Otherwise UTF-8, falling back to Windows-1252 (a superset of
    /// the Latin-1 letters) when the bytes are not valid UTF-8, because some banks declare the charset wrongly.
    /// </summary>
    private static string Decode(byte[] content)
    {
        var header = Encoding.ASCII.GetString(content, 0, Math.Min(content.Length, 512));
        if (header.Contains("CHARSET:1252", StringComparison.OrdinalIgnoreCase)) return Read(content, Encoding.GetEncoding(1252));

        try
        {
            return Read(content, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true));
        }
        catch (DecoderFallbackException)
        {
            return Read(content, Encoding.GetEncoding(1252));
        }
    }

    private static string Read(byte[] content, Encoding encoding)
    {
        using var reader = new StreamReader(new MemoryStream(content), encoding, detectEncodingFromByteOrderMarks: true);
        return reader.ReadToEnd();
    }

    // <TAG>value  — value stops at the next tag or line break (works for SGML and XML).
    [GeneratedRegex(@"<(\w+)>([^<\r\n]*)")]
    private static partial Regex LeafTag();
}
