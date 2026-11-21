using System.ComponentModel.DataAnnotations;
using FinanceTracker.Api.Auth;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Common;
using FinanceTracker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Api.Controllers;

public sealed record RegisterRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(100, MinimumLength = 8)] string Password);

public sealed record LoginRequest([Required] string Email, [Required] string Password);

public sealed record DeleteProfileRequest([Required] string Password);

[ApiController]
[Route("api/auth")]
[EnableRateLimiting(AuthRateLimit.Policy)]
public sealed class AuthController(
    UserManager<IdentityUser<Guid>> users,
    SignInManager<IdentityUser<Guid>> signIn,
    TokenService tokens,
    CategoryService categories,
    AppDbContext db) : ControllerBase
{
    /// <summary>Creates the user with the default categories and returns a token (already logged in).</summary>
    [HttpPost("register")]
    [AllowAnonymous]
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
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email);

        // lockoutOnFailure: after 5 wrong passwords the account is locked for 5 minutes (brute force).
        if (user is null || !(await signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true)).Succeeded)
            // Same answer for "unknown e-mail" and "wrong password": does not reveal which e-mails exist.
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "E-mail ou senha inválidos.");

        return Ok(tokens.CreateToken(user));
    }

    /// <summary>Permanently deletes the logged-in user and all their data. Requires the password again.</summary>
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteProfile(
        DeleteProfileRequest request, [FromServices] ICurrentUser currentUser, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(currentUser.UserId.ToString());
        if (user is null) return NotFound();

        // 400, not 401: the session is valid, and the client treats 401 as "logged out".
        if (!(await signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true)).Succeeded)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Senha incorreta",
                detail: "Confira a senha e tente de novo.");

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        // Accounts first: their cascade removes the transactions, which reference categories with NO ACTION.
        await db.Accounts.Where(a => a.UserId == user.Id).ExecuteDeleteAsync(ct);
        var result = await users.DeleteAsync(user);
        if (!result.Succeeded) throw new InvalidOperationException("Could not delete the user.");

        await transaction.CommitAsync(ct);
        return NoContent();
    }
}
