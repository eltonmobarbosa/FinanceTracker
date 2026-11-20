using System.ComponentModel.DataAnnotations;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Accounts;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Application.Accounts;

public sealed record AccountDto(int Id, string Name, AccountType Type);

public sealed record CreateAccountRequest(
    [Required, StringLength(Account.NameMaxLength)] string Name,
    [EnumDataType(typeof(AccountType))] AccountType Type);

public sealed class AccountService(IAppDbContext db, ICurrentUser user)
{
    public Task<List<AccountDto>> ListAsync(CancellationToken ct) =>
        db.OwnedAccounts(user.UserId)
            .OrderBy(a => a.Name)
            .Select(a => new AccountDto(a.Id, a.Name, a.Type))
            .ToListAsync(ct);

    public async Task<AccountDto> CreateAsync(CreateAccountRequest request, CancellationToken ct)
    {
        var account = new Account(user.UserId, request.Name, request.Type);
        db.Accounts.Add(account);
        await db.SaveChangesAsync(ct);
        return new AccountDto(account.Id, account.Name, account.Type);
    }

    /// <summary>Also deletes the account's transactions (cascade).</summary>
    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var account = await db.OwnedAccounts(user.UserId).GetAsync(id, "Conta", ct);
        db.Accounts.Remove(account);
        await db.SaveChangesAsync(ct);
    }
}
