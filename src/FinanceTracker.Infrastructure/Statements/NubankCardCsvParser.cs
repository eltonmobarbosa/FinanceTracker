using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using FinanceTracker.Application.Statements;
using Microsoft.VisualBasic.FileIO;

namespace FinanceTracker.Infrastructure.Statements;

/// <summary>
/// Nubank credit card statement exported as CSV:
/// <code>
/// date,title,amount
/// 2026-10-16,Disney Plus,"69,90"
/// 2026-10-08,Pagamento recebido,"- 3.520,94"
/// </code>
/// Amounts use pt-BR format. On a card statement a positive amount is a purchase, so the sign is inverted
/// to match the app convention (negative = money out).
/// </summary>
public sealed partial class NubankCardCsvParser : IStatementParser
{
    private const string Header = "date,title,amount";
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    public bool CanParse(string fileName, byte[] content)
    {
        if (!fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)) return false;

        using var reader = OpenText(content);
        return string.Equals(reader.ReadLine()?.Trim(), Header, StringComparison.OrdinalIgnoreCase);
    }

    public IReadOnlyList<ParsedTransaction> Parse(byte[] content)
    {
        // TextFieldParser ships with .NET and handles quoted fields with commas and escaped quotes
        // ("IOF de ""Anthropic"""), which a plain string.Split(',') gets wrong.
        using var csv = new TextFieldParser(OpenText(content))
        {
            TextFieldType = FieldType.Delimited,
            HasFieldsEnclosedInQuotes = true,
        };
        csv.SetDelimiters(",");
        csv.ReadFields(); // header

        var ids = new ExternalIds();
        var transactions = new List<ParsedTransaction>();

        while (!csv.EndOfData)
        {
            var lineNumber = csv.LineNumber;
            string[]? fields;
            try
            {
                fields = csv.ReadFields();
            }
            catch (MalformedLineException)
            {
                throw new StatementFormatException($"Linha {lineNumber}: CSV malformado.");
            }

            if (fields is null) continue;
            if (fields.Length != 3)
                throw new StatementFormatException($"Linha {lineNumber}: esperadas 3 colunas, encontradas {fields.Length}.");

            if (!DateOnly.TryParseExact(fields[0].Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var date))
                throw new StatementFormatException($"Linha {lineNumber}: data inválida '{fields[0]}'.");

            // "- 3.520,94" -> "-3.520,94": Nubank puts a space after the minus sign.
            // Strict format first: pt-BR parsing alone reads "69.90" as 6990 (the dot is a thousands separator).
            var amountText = fields[2].Replace(" ", "");
            if (!BrazilianAmount().IsMatch(amountText) ||
                !decimal.TryParse(amountText, NumberStyles.Number, PtBr, out var cardAmount))
                throw new StatementFormatException($"Linha {lineNumber}: valor inválido '{fields[2]}'.");

            var amount = -cardAmount;
            var description = fields[1].Trim();

            transactions.Add(new ParsedTransaction(
                date, amount, description, ids.Unique(ExternalIds.Hash(date, amount, description))));
        }

        return transactions;
    }

    // Nubank exports UTF-8; a BOM, if present, is detected and skipped.
    private static StreamReader OpenText(byte[] content) =>
        new(new MemoryStream(content), Encoding.UTF8, detectEncodingFromByteOrderMarks: true);

    [GeneratedRegex(@"^-?(\d{1,3}(\.\d{3})+|\d+),\d{2}$")]
    private static partial Regex BrazilianAmount();
}
