using FinanceTracker.Domain.Common;

namespace FinanceTracker.Domain.Transactions;

/// <summary>One line of a bank statement.</summary>
public sealed class Transaction : Entity
{
    public const int DescriptionMaxLength = 500;
    public const int ExternalIdMaxLength = 255; // OFX spec: FITID has up to 255 chars

    public int AccountId { get; private set; }
    public DateOnly Date { get; private set; }

    /// <summary>Negative = money out (debit), positive = money in (credit).</summary>
    public decimal Amount { get; private set; }

    public string Description { get; private set; } = null!;

    /// <summary>
    /// Identity of this transaction at the bank: OFX FITID, or a hash of the CSV line.
    /// Unique per account, so importing the same statement twice does not duplicate rows.
    /// </summary>
    public string ExternalId { get; private set; } = null!;

    public int? CategoryId { get; private set; }

    private Transaction() { } // EF Core materialization

    public Transaction(int accountId, DateOnly date, decimal amount, string description, string externalId)
    {
        AccountId = accountId;
        Date = date;
        Amount = amount;
        Description = Text.Required(description, DescriptionMaxLength, nameof(description));
        ExternalId = Text.Required(externalId, ExternalIdMaxLength, nameof(externalId));
    }

    public void Categorize(int? categoryId) => CategoryId = categoryId;
}
