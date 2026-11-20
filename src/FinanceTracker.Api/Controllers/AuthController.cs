using System.ComponentModel.DataAnnotations;
using FinanceTracker.Api.Auth;
using FinanceTracker.Application.Categories;
using FinanceTracker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

public sealed record RegisterRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(100, MinimumLength = 8)] string Password);

public sealed record LoginRequest([Required] string Email, [Required] string Password);

[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public sealed class AuthController(
    UserManager<IdentityUser<Guid>> users,
    SignInManager<IdentityUser<Guid>> signIn,
    TokenService tokens,
    CategoryService categories,
    AppDbContext db) : ControllerBase
{
    /// <summary>Creates the user with the default categories and returns a token (already logged in).</summary>
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct)
    {
        var user = new IdentityUser<Guid> { UserName = request.Email, Email = request.Email };

        // User + default categories commit together: no user is left without categories if seeding fails.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors) ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }

        await categories.SeedDefaultsAsync(user.Id, ct);
        await transaction.CommitAsync(ct);

        return Ok(tokens.CreateToken(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email);

        // lockoutOnFailure: after 5 wrong passwords the account is locked for 5 minutes (brute force).
        if (user is null || !(await signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true)).Succeeded)
            // Same answer for "unknown e-mail" and "wrong password": does not reveal which e-mails exist.
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "E-mail ou senha inválidos.");

        return Ok(tokens.CreateToken(user));
    }
}
