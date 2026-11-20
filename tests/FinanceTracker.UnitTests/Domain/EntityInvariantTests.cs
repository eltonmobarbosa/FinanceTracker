using FinanceTracker.Domain.Accounts;
using FinanceTracker.Domain.Categories;
using FinanceTracker.Domain.Transactions;

namespace FinanceTracker.UnitTests.Domain;

public class EntityInvariantTests
{
    private static readonly Guid User = Guid.NewGuid();

    [Fact]
    public void Account_requires_a_user() =>
        Assert.Throws<ArgumentException>(() => new Account(Guid.Empty, "Nubank", AccountType.Checking));

    [Fact]
    public void Account_rejects_unknown_type() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => new Account(User, "Nubank", (AccountType)99));

    [Fact]
    public void Category_name_longer_than_limit_is_rejected() =>
        Assert.Throws<ArgumentException>(() => new Category(User, new string('x', Category.NameMaxLength + 1)));

    [Fact]
    public void Transaction_requires_external_id() =>
        Assert.Throws<ArgumentException>(() =>
            new Transaction(accountId: 1, new DateOnly(2026, 11, 1), -10m, "UBER", externalId: " "));

    [Fact]
    public void Transaction_starts_uncategorized_and_can_be_categorized()
    {
        var transaction = new Transaction(accountId: 1, new DateOnly(2026, 11, 1), -10m, "UBER", "FITID123");
        Assert.Null(transaction.CategoryId);

        transaction.Categorize(5);

        Assert.Equal(5, transaction.CategoryId);
    }
}
