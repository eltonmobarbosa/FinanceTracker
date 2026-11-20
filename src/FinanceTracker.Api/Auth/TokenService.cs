using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FinanceTracker.Api.Auth;

/// <summary>"Jwt" section of the configuration. The key comes from user-secrets (dev) or an environment variable.</summary>
public sealed class JwtOptions
{
    public const string Section = "Jwt";

    [Required] public string Issuer { get; init; } = null!;
    [Required] public string Audience { get; init; } = null!;

    // HMAC-SHA256 needs at least 256 bits.
    [Required, MinLength(32)] public string Key { get; init; } = null!;

    [Range(5, 24 * 60)] public int ExpirationMinutes { get; init; } = 480;

    public SymmetricSecurityKey SigningKey() => new(Encoding.UTF8.GetBytes(Key));
}

public sealed record AuthResponse(string AccessToken, DateTime ExpiresAt, string Email);

public sealed class TokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    public AuthResponse CreateToken(IdentityUser<Guid> user)
    {
        var jwt = options.Value;
        var expiresAt = clock.GetUtcNow().UtcDateTime.AddMinutes(jwt.ExpirationMinutes);

        var token = new JwtSecurityToken(
            issuer: jwt.Issuer,
            audience: jwt.Audience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email!),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            ],
            expires: expiresAt,
            signingCredentials: new SigningCredentials(jwt.SigningKey(), SecurityAlgorithms.HmacSha256));

        return new AuthResponse(new JwtSecurityTokenHandler().WriteToken(token), expiresAt, user.Email!);
    }
}
