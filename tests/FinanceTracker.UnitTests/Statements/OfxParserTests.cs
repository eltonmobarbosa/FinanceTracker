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
        Assert.Equal(new ParsedTransaction(new DateOnly(2026, 10, 16), -50.00m, "PADARIA SÃO JOÃO", "20261016001"), result[0]);
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

        Assert.Equal(new ParsedTransaction(new DateOnly(2026, 10, 20), -12.34m, "Café", "X1"), Assert.Single(result));
    }

    [Fact]
    public void Repeated_fitid_inside_one_file_is_made_unique()
    {
        var duplicated = SgmlSample.Replace("20261017001", "20261016001");

        var result = _parser.Parse(Windows1252(duplicated));

        Assert.Equal(["20261016001", "20261016001#1"], result.Select(t => t.ExternalId));
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
