using FinanceTracker.Domain.Categories;

namespace FinanceTracker.UnitTests.Domain;

public class CategoryRuleTests
{
    [Theory]
    [InlineData("UBER *TRIP", "uber")]                     // case
    [InlineData("PADARIA SAO JOAO", "padaria são joão")]   // accents in the pattern
    [InlineData("Padaria São João", "SAO JOAO")]           // accents in the description
    [InlineData("PIX ENVIADO - MERCADO LIVRE", "mercado")] // substring in the middle
    public void Matches_ignores_case_and_accents(string description, string pattern)
    {
        var rule = new CategoryRule(categoryId: 1, pattern);

        Assert.True(rule.Matches(description));
    }

    [Fact]
    public void Matches_returns_false_when_pattern_is_absent()
    {
        var rule = new CategoryRule(categoryId: 1, "ifood");

        Assert.False(rule.Matches("UBER *TRIP"));
    }

    [Fact]
    public void Pattern_is_trimmed()
    {
        var rule = new CategoryRule(categoryId: 1, "  uber  ");

        Assert.Equal("uber", rule.Pattern);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Blank_pattern_is_rejected(string pattern) =>
        Assert.Throws<ArgumentException>(() => new CategoryRule(categoryId: 1, pattern));
}
