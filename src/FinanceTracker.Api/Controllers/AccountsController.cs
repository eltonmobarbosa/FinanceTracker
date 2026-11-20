using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Imports;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[ApiController]
[Route("api/accounts")]
public sealed class AccountsController(AccountService accounts, ImportService imports) : ControllerBase
{
    private const long MaxStatementBytes = 5 * 1024 * 1024; // years of statements fit in far less

    [HttpGet]
    public Task<List<AccountDto>> List(CancellationToken ct) => accounts.ListAsync(ct);

    [HttpPost]
    public async Task<ActionResult<AccountDto>> Create(CreateAccountRequest request, CancellationToken ct) =>
        Created($"api/accounts", await accounts.CreateAsync(request, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await accounts.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>Imports an OFX or CSV statement file into the account (multipart/form-data, field "file").</summary>
    [HttpPost("{id:int}/imports")]
    [RequestSizeLimit(MaxStatementBytes + 64 * 1024)] // + multipart overhead; rejects huge uploads before reading
    public async Task<ActionResult<ImportResult>> Import(int id, IFormFile file, CancellationToken ct)
    {
        if (file.Length is 0 or > MaxStatementBytes)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Arquivo inválido",
                detail: "O arquivo deve ter entre 1 byte e 5 MB.");

        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, ct);

        return await imports.ImportAsync(id, file.FileName, buffer.ToArray(), ct);
    }
}
