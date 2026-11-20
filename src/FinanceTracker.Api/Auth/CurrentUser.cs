using System.IdentityModel.Tokens.Jwt;
using FinanceTracker.Application.Common;

namespace FinanceTracker.Api.Auth;

/// <summary>Reads the user id from the validated JWT ("sub" claim) of the current request.</summary>
public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id)
            ? id
            // Only reachable if an endpoint forgot [Authorize]: fail loudly instead of using an empty id.
            : throw new InvalidOperationException("No authenticated user in the current request.");
}
