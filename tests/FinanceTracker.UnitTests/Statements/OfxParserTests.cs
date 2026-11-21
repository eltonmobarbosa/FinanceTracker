using System.Text;
using FinanceTracker.Application.Statements;
using FinanceTracker.Infrastructure.Statements;

namespace FinanceTracker.UnitTests.Statements;

public class OfxParserTests
{
    // OFX v1 (SGML): header lines, leaf tags without closing tags, Windows-1252 charset.
    private const string SgmlSample = """
        OFXHEADER:100
        DATA:OFXSGML
        VERSION:102
        CHARSET:1252

        <OFX>
        <BANKMSGSRSV1><STMTTRNRS><STMTRS>
        <BANKTRANLIST>
        <STMTTRN>
        <TRNTYPE>DEBIT
        <DTPOSTED>20261016120000[-3:BRT]
        <TRNAMT>-50.00
        <FITID>20261016001
        <MEMO>PADARIA SÃO JOÃO
        </STMTTRN>
        <STMTTRN>
        <TRNTYPE>CREDIT
        <DTPOSTED>20261017
        <TRNAMT>1500,00
        <FITID>20261017001
        <NAME>SALARIO
        </STMTTRN>
        </BANKTRANLIST>
        </STMTRS></STMTTRNRS></BANKMSGSRSV1>
        </OFX>
        """;

    // OFX v2 (XML): every tag closed, UTF-8.
    private const string XmlSample = """
        <?xml version="1.0" encoding="UTF-8"?>
        <?OFX OFXHEADER="200" VERSION="220"?>
        <OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
        <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261020</DTPOSTED><TRNAMT>-12.34</TRNAMT><FITID>X1</FITID><MEMO>Café</MEMO></STMTTRN>
        </BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
        """;

    private readonly OfxParser _parser = new();

    private static byte[] Windows1252(string text)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        return Encoding.GetEncoding(1252).GetBytes(text);
    }

    [Fact]
    public void Parses_sgml_v1_with_windows_1252_accents()
    {
        var result = _parser.Parse(Windows1252(SgmlSample));

        Assert.Equal(2, result.Count);
        Assert.Equal(new ParsedTransaction(new DateOnly(2026, 10, 16), -50.00m, "PADARIA SÃO JOÃO", "20261016001~20261016~-50.00"), result[0]);
    }

    [Fact]
    public void Uses_NAME_when_MEMO_is_missing_and_accepts_comma_decimal()
    {
        var salary = _parser.Parse(Windows1252(SgmlSample))[1];

        Assert.Equal("SALARIO", salary.Description);
        Assert.Equal(1500.00m, salary.Amount);
    }

    [Fact]
    public void Parses_xml_v2_in_utf8()
    {
        var result = _parser.Parse(Encoding.UTF8.GetBytes(XmlSample));

        Assert.Equal(new ParsedTransaction(new DateOnly(2026, 10, 20), -12.34m, "Café", "X1~20261020~-12.34"), Assert.Single(result));
    }

    private static string Line(string fitId, string date, string amount, string memo) =>
        $"<STMTTRN><FITID>{fitId}\n<DTPOSTED>{date}\n<TRNAMT>{amount}\n<MEMO>{memo}\n</STMTTRN>\n";

    [Fact]
    public void Identical_lines_with_the_same_fitid_are_kept_apart()
    {
        var line = Line("X", "20261001", "-10.00", "Cafe");

        var result = _parser.Parse(Encoding.UTF8.GetBytes("<OFX>" + line + line));

        Assert.Equal(["X~20261001~-10.00", "X~20261001~-10.00#1"], result.Select(t => t.ExternalId));
    }

    [Fact]
    public void Fitid_reused_across_files_does_not_hide_a_new_transaction()
    {
        var first = _parser.Parse(Encoding.UTF8.GetBytes(
            "<OFX>" + Line("X", "20261001", "-10.00", "A") + Line("X", "20261002", "-20.00", "B")));
        var second = _parser.Parse(Encoding.UTF8.GetBytes(
            "<OFX>" + Line("X", "20261002", "-20.00", "B") + Line("X", "20261003", "-30.00", "C")));

        var known = first.Select(t => t.ExternalId).ToHashSet();

        Assert.Equal("C", Assert.Single(second, t => !known.Contains(t.ExternalId)).Description);
    }

    [Fact]
    public void Xml_entities_are_decoded() =>
        Assert.Equal("C&A LOJA", Assert.Single(_parser.Parse(Encoding.UTF8.GetBytes(
            "<OFX>" + Line("1", "20261016", "-10.00", "C&amp;A LOJA")))).Description);

    [Fact]
    public void Latin1_file_without_charset_header_keeps_accents() =>
        Assert.Equal("PADARIA SÃO JOÃO", Assert.Single(_parser.Parse(Encoding.Latin1.GetBytes(
            "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><OFX>" + Line("1", "20261016", "-10.00", "PADARIA SÃO JOÃO")))).Description);

    [Theory]
    [InlineData("-1.234,56", -1234.56)]
    [InlineData("-1,234.56", -1234.56)]
    [InlineData("-50,00", -50.00)]
    [InlineData("-50.00", -50.00)]
    public void Amount_formats_are_read(string text, double expected) =>
        Assert.Equal((decimal)expected, Assert.Single(_parser.Parse(Encoding.UTF8.GetBytes(
            "<OFX>" + Line("1", "20261016", text, "X")))).Amount);

    [Fact]
    public void File_full_of_unclosed_tags_is_parsed_quickly()
    {
        var malicious = "<OFX>" + string.Concat(Enumerable.Repeat("<STMTTRN>", 5 * 1024 * 1024 / 9));

        var watch = System.Diagnostics.Stopwatch.StartNew();
        Assert.Empty(_parser.Parse(Encoding.UTF8.GetBytes(malicious)));

        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(5), $"took {watch.Elapsed}");
    }

    [Fact]
    public void Missing_fitid_is_reported()
    {
        var broken = SgmlSample.Replace("<FITID>20261016001", "");

        var ex = Assert.Throws<StatementFormatException>(() => _parser.Parse(Windows1252(broken)));
        Assert.Contains("<FITID>", ex.Message);
    }

    [Theory]
    [InlineData("extrato.ofx", "<OFX></OFX>", true)]
    [InlineData("extrato.OFX", "<ofx></ofx>", true)]
    [InlineData("extrato.csv", "<OFX></OFX>", false)]
    [InlineData("extrato.ofx", "date,title,amount", false)]
    public void CanParse_checks_extension_and_ofx_tag(string fileName, string content, bool expected) =>
        Assert.Equal(expected, _parser.CanParse(fileName, Encoding.UTF8.GetBytes(content)));
}
