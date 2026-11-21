using System.Text;
using FinanceTracker.Application.Statements;
using FinanceTracker.Infrastructure.Statements;

namespace FinanceTracker.UnitTests.Statements;

public class NubankCardCsvParserTests
{
    // Fictitious data in the real Nubank card layout.
    // Four-quote delimiter because the sample itself contains """ (CSV escaped quotes).
    private const string Sample = """"
        date,title,amount
        2026-10-16,Streaming Plus,"69,90"
        2026-10-14,Pix no Crédito - Fulano de Tal,"2.220,66"
        2026-10-13,"IOF de ""Loja* Assinatura""","4,00"
        2026-10-08,Pagamento recebido,"- 3.520,94"
        2026-10-03,Loja Roupas - Parcela 3/3,"126,56"
        """";

    private readonly NubankCardCsvParser _parser = new();

    private static byte[] Bytes(string text) => Encoding.UTF8.GetBytes(text);

    [Fact]
    public void Parses_every_line()
    {
        var result = _parser.Parse(Bytes(Sample));

        Assert.Equal(5, result.Count);
        Assert.Equal(new DateOnly(2026, 10, 16), result[0].Date);
        Assert.Equal("Streaming Plus", result[0].Description);
    }

    [Fact]
    public void Purchase_becomes_negative_and_payment_becomes_positive()
    {
        var result = _parser.Parse(Bytes(Sample));

        Assert.Equal(-2220.66m, result[1].Amount);  // "2.220,66": pt-BR thousands + decimal separators
        Assert.Equal(3520.94m, result[3].Amount);   // "- 3.520,94": space after the minus sign
    }

    [Fact]
    public void Quoted_description_with_escaped_quotes_is_read_whole() =>
        Assert.Equal("IOF de \"Loja* Assinatura\"", _parser.Parse(Bytes(Sample))[2].Description);

    [Fact]
    public void Parsing_the_same_file_twice_yields_the_same_external_ids()
    {
        var first = _parser.Parse(Bytes(Sample)).Select(t => t.ExternalId);
        var second = _parser.Parse(Bytes(Sample)).Select(t => t.ExternalId);

        Assert.Equal(first, second);
    }

    [Fact]
    public void Identical_lines_are_kept_as_distinct_transactions()
    {
        const string twoCoffees = """
            date,title,amount
            2026-10-10,Cafeteria,"8,00"
            2026-10-10,Cafeteria,"8,00"
            """;

        var result = _parser.Parse(Bytes(twoCoffees));

        Assert.Equal(2, result.Count);
        Assert.NotEqual(result[0].ExternalId, result[1].ExternalId);
    }

    [Fact]
    public void Utf8_bom_is_ignored()
    {
        var withBom = Encoding.UTF8.GetPreamble().Concat(Bytes(Sample)).ToArray();

        Assert.True(_parser.CanParse("fatura.csv", withBom));
        Assert.Equal(5, _parser.Parse(withBom).Count);
    }

    [Theory]
    [InlineData("fatura.csv", "date,title,amount\n", true)]
    [InlineData("FATURA.CSV", "date,title,amount\n", true)]
    [InlineData("fatura.ofx", "date,title,amount\n", false)]       // wrong extension
    [InlineData("extrato.csv", "Data,Valor,Identificador,Descrição\n", false)] // another layout
    public void CanParse_checks_extension_and_header(string fileName, string content, bool expected) =>
        Assert.Equal(expected, _parser.CanParse(fileName, Bytes(content)));

    [Theory]
    [InlineData("2026-10-16,Loja,\"abc\"", "valor inválido")]
    [InlineData("2026-10-16,Loja,69.90", "valor inválido")] // would silently become 6990
    [InlineData("2026-10-16,Loja,\"1.23,45\"", "valor inválido")]
    [InlineData("16/10/2026,Loja,\"10,00\"", "data inválida")]
    [InlineData("2026-10-16,Loja", "esperadas 3 colunas")]
    public void Malformed_line_reports_line_number_and_problem(string line, string expectedMessage)
    {
        var ex = Assert.Throws<StatementFormatException>(() => _parser.Parse(Bytes($"date,title,amount\n{line}")));

        Assert.Contains("Linha 2", ex.Message);
        Assert.Contains(expectedMessage, ex.Message);
    }
}
