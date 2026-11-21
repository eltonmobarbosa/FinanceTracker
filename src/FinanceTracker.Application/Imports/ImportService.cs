using FinanceTracker.Application.Common;
using FinanceTracker.Application.Statements;
using FinanceTracker.Domain.Accounts;
using FinanceTracker.Domain.Categories;
using FinanceTracker.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Application.Imports;

/// <param name="Total">Lines read from the file.</param>
/// <param name="Imported">New transactions saved.</param>
/// <param name="Duplicates">Lines already imported before (skipped).</param>
/// <param name="Categorized">New transactions that a rule categorized.</param>
/// <param name="ImportId">Identifies this upload so it can be undone. Null when nothing new was saved.</param>
public sealed record ImportResult(int Total, int Imported, int Duplicates, int Categorized, Guid? ImportId = null);

public sealed class ImportService(IAppDbContext db, ICurrentUser user, IEnumerable<IStatementParser> parsers)
{
    public async Task<ImportResult> ImportAsync(int accountId, string fileName, byte[] content, CancellationToken ct)
    {
        var account = await db.OwnedAccounts(user.UserId).GetAsync(accountId, "Conta", ct);

        var parser = parsers.FirstOrDefault(p => p.CanParse(fileName, content))
            ?? throw new StatementFormatException(
                "Formato não suportado. Envie um arquivo OFX ou o CSV da fatura do cartão Nubank.");

        var parsed = parser.Parse(content);

        // One query for the whole file instead of one per line.
        var externalIds = parsed.Select(p => p.ExternalId).ToList();
        var alreadyImported = (await db.Transactions
                .Where(t => t.AccountId == account.Id && externalIds.Contains(t.ExternalId))
                .Select(t => t.ExternalId)
                .ToListAsync(ct))
            .ToHashSet(StringComparer.Ordinal);

        var rules = await db.OwnedRules(user.UserId).AsNoTracking().ToListAsync(ct);
        var categorizer = new Categorizer(account.Type == AccountType.CreditCard ? rules : rules.Where(r => !r.IsCardOnly));
        var importId = Guid.NewGuid();
        int imported = 0, categorized = 0;

        foreach (var line in parsed.Where(p => !alreadyImported.Contains(p.ExternalId)))
        {
            var transaction = new Transaction(account.Id, line.Date, line.Amount, line.Description, line.ExternalId, importId);

            var categoryId = categorizer.Categorize(line.Description);
            if (categoryId is not null)
            {
                transaction.Categorize(categoryId);
                categorized++;
            }

            db.Transactions.Add(transaction);
            imported++;
        }

        // All lines in one SaveChanges = one database transaction: a failure imports nothing.
        // If another import of the same file runs concurrently, the unique index (AccountId, ExternalId)
        // rejects this save and the Api answers 409 instead of creating duplicates.
        await db.SaveChangesAsync(ct);

        return new ImportResult(parsed.Count, imported, parsed.Count - imported, categorized, imported > 0 ? importId : null);
    }

    /// <summary>Removes exactly the rows one upload created (a statement sent to the wrong account, for example).</summary>
    public async Task UndoAsync(int accountId, Guid importId, CancellationToken ct)
    {
        var account = await db.OwnedAccounts(user.UserId).GetAsync(accountId, "Conta", ct);

        var rows = await db.Transactions.Where(t => t.AccountId == account.Id && t.ImportId == importId).ToListAsync(ct);
        if (rows.Count == 0) throw new NotFoundException("Importação");

        db.Transactions.RemoveRange(rows);
        await db.SaveChangesAsync(ct);
    }
}
