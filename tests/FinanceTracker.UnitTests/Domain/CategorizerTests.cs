using FinanceTracker.Domain.Categories;

namespace FinanceTracker.UnitTests.Domain;

public class CategorizerTests
{
    private const int Food = 1, Shopping = 2, Taxes = 3, Subscriptions = 4;

    [Fact]
    public void Returns_null_when_no_rule_matches()
    {
        var categorizer = new Categorizer([new CategoryRule(Food, "ifood")]);

        Assert.Null(categorizer.Categorize("UBER *TRIP"));
    }

    [Fact]
    public void Longer_pattern_wins_on_equal_priority()
    {
        var categorizer = new Categorizer([new CategoryRule(Food, "mercado"), new CategoryRule(Shopping, "mercado livre")]);

        Assert.Equal(Shopping, categorizer.Categorize("PIX MERCADO LIVRE"));
        Assert.Equal(Food, categorizer.Categorize("MERCADO DO BAIRRO"));
    }

    [Fact]
    public void Higher_priority_wins_over_longer_pattern()
    {
        // "IOF de "Anthropic* Claude Sub"" is a tax, not a subscription.
        var categorizer = new Categorizer(
            [new CategoryRule(Subscriptions, "anthropic"), new CategoryRule(Taxes, "iof", priority: 10)]);

        Assert.Equal(Taxes, categorizer.Categorize("IOF de \"Anthropic* Claude Sub\""));
        Assert.Equal(Subscriptions, categorizer.Categorize("Anthropic* Claude Sub"));
    }

    [Fact]
    public void Works_with_no_rules() => Assert.Null(new Categorizer([]).Categorize("anything"));
}
