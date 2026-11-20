using FinanceTracker.Domain.Common;

namespace FinanceTracker.Domain.Accounts;

public enum AccountType
{
    Checking = 1,
    CreditCard = 2,
}

/// <summary>A bank account or credit card owned by one user. Statements are imported into an account.</summary>
public sealed class Account : Entity
{
    public const int NameMaxLength = 100;

    public Guid UserId { get; private set; }
    public string Name { get; private set; } = null!;
    public AccountType Type { get; private set; }

    private Account() { } // EF Core materialization

    public Account(Guid userId, string name, AccountType type)
    {
        if (userId == Guid.Empty) throw new ArgumentException("User is required.", nameof(userId));
        if (!Enum.IsDefined(type)) throw new ArgumentOutOfRangeException(nameof(type));

        UserId = userId;
        Name = Text.Required(name, NameMaxLength, nameof(name));
        Type = type;
    }
}
