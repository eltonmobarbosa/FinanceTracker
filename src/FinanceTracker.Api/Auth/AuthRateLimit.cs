using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FinanceTracker.Api.Auth;

/// <summary>Limits login and sign-up attempts per IP, so one client cannot guess passwords or lock other users out.</summary>
internal static class AuthRateLimit
{
    public const string Policy = "auth";

    // shortcut: uses the connection IP, so behind a reverse proxy all clients share one limit; add ForwardedHeaders then.
    public static void Configure(RateLimiterOptions options)
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.OnRejected = (context, ct) => new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Muitas tentativas",
                Detail = "Aguarde um minuto e tente de novo.",
            },
            options: null, contentType: "application/problem+json", ct));

        options.AddPolicy(Policy, context => RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    }
}
