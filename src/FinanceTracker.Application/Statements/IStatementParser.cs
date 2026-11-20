namespace FinanceTracker.Application.Statements;

/// <summary>One transaction read from a statement file, before it is saved.</summary>
/// <param name="Amount">Negative = money out, positive = money in (parsers normalize each bank's convention).</param>
/// <param name="ExternalId">Stable id of the transaction at the bank. Same file parsed twice yields the same ids.</param>
public sealed record ParsedTransaction(DateOnly Date, decimal Amount, string Description, string ExternalId);

/// <summary>
/// Reads one statement file layout (Strategy pattern). Supporting a new bank or format means adding a new
/// implementation; existing parsers and the import use case do not change.
/// </summary>
public interface IStatementParser
{
    /// <summary>True when this parser recognizes the file (by extension and/or content).</summary>
    bool CanParse(string fileName, byte[] content);

    /// <exception cref="StatementFormatException">The file is recognized but malformed.</exception>
    IReadOnlyList<ParsedTransaction> Parse(byte[] content);
}

/// <summary>The statement file is broken. The message is safe to show to the user.</summary>
public sealed class StatementFormatException(string message) : Exception(message);
