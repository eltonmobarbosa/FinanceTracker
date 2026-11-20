using FinanceTracker.Application.Transactions;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[ApiController]
[Route("api/transactions")]
public sealed class TransactionsController(TransactionService transactions) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<TransactionDto>> Search([FromQuery] TransactionQuery query, CancellationToken ct) =>
        transactions.SearchAsync(query, ct);

    [HttpPut("{id:int}/category")]
    public Task<CategorizeResult> Categorize(int id, CategorizeRequest request, CancellationToken ct) =>
        transactions.CategorizeAsync(id, request, ct);
}
