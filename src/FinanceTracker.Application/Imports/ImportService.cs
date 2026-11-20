using FinanceTracker.Application.Common;
using FinanceTracker.Application.Statements;
using FinanceTracker.Domain.Categories;
using FinanceTracker.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Application.Imports;

/// <param name="Total">Lines read from the file.</param>
/// <param name="Imported">New transactions saved.</param>
/// <param name="Duplicates">Lines already imported before (skipped).</param>
/// <param name="Categorized">New transactions that a rule categorized.</param>
public sealed record ImportResult(int Total, int Imported, int Duplicates, int Categorized);

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

        var categorizer = new Categorizer(await db.OwnedRules(user.UserId).AsNoTracking().ToListAsync(ct));
        int imported = 0, categorized = 0;

        foreach (var line in parsed.Where(p => !alreadyImported.Contains(p.ExternalId)))
        {
            var transaction = new Transaction(account.Id, line.Date, line.Amount, line.Description, line.ExternalId);

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

        return new ImportResult(parsed.Count, imported, parsed.Count - imported, categorized);
    }
}
