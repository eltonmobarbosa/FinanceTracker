using FinanceTracker.Application.Common;
using FinanceTracker.Application.Statements;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Api;

/// <summary>
/// Translates exceptions thrown by the use cases into HTTP status codes, in one place, so controllers
/// have no try/catch. Anything not listed falls through to the default 500 (without stack trace).
/// </summary>
internal sealed class ApiExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        (int Status, string Title)? mapped = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, "Não encontrado"),
            ConflictException => (StatusCodes.Status409Conflict, "Conflito"),
            StatementFormatException => (StatusCodes.Status400BadRequest, "Arquivo inválido"),
            // Domain invariants (name too long, blank description...). Request DTOs validate first, so this
            // is the safety net for rules only the domain knows.
            ArgumentException => (StatusCodes.Status400BadRequest, "Dados inválidos"),
            // Unique index violated by a concurrent request (e.g. same file imported twice at the same time).
            DbUpdateException => (StatusCodes.Status409Conflict, "Conflito"),
            _ => null,
        };

        if (mapped is not var (status, title)) return false;

        var detail = exception is DbUpdateException
            ? "Os dados foram alterados por outra operação ao mesmo tempo. Tente novamente."
            : exception.Message;

        context.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails = { Status = status, Title = title, Detail = detail },
        });
    }
}
