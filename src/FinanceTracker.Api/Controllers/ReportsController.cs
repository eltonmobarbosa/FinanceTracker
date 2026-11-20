using FinanceTracker.Application.Reports;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[ApiController]
[Route("api/reports")]
public sealed class ReportsController(ReportService reports) : ControllerBase
{
    [HttpGet("summary")]
    public Task<SummaryDto> Summary(DateOnly? from, DateOnly? to, int? accountId, CancellationToken ct) =>
        reports.GetSummaryAsync(from, to, accountId, ct);
}
