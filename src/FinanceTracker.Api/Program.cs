using System.Text.Json.Serialization;
using FinanceTracker.Api;
using FinanceTracker.Api.Auth;
using FinanceTracker.Application;
using FinanceTracker.Application.Common;
using FinanceTracker.Infrastructure;
using FinanceTracker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Dev: appsettings.Development.json. Production: environment variable ConnectionStrings__Default.
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

builder.Services.AddInfrastructure(connectionString);
builder.Services.AddApplication();

// ---- Authentication: ASP.NET Identity stores users/password hashes; JWT carries the session. ----
builder.Services
    .AddIdentityCore<IdentityUser<Guid>>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
        options.Lockout.MaxFailedAccessAttempts = 5;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager();

builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart(); // missing/short key = the app refuses to start, instead of failing at first login

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<Microsoft.Extensions.Options.IOptions<JwtOptions>>((bearer, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        bearer.MapInboundClaims = false; // keep "sub" as "sub" (no legacy SOAP claim names)
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.SigningKey(),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

// Secure by default: every endpoint requires a logged-in user unless it says [AllowAnonymous].
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

builder.Services.AddRateLimiter(AuthRateLimit.Configure);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<TokenService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

// Enums travel as text ("Checking"), not numbers: readable API, stable if enum values are reordered.
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();

// Every error response (validation, 404, unhandled exception) uses the RFC 9457 "problem details" JSON format,
// so the Angular client handles errors in one place.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

// /health also opens a connection to SQL Server: "Healthy" means the API can reach the database.
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();

var app = builder.Build();

// Unhandled exceptions become a ProblemDetails response without leaking the stack trace.
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

// Production only: the automated tests register many users from one address.
if (app.Environment.IsProduction()) app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();

// Lets the integration tests start the real app in memory (WebApplicationFactory<Program>).
public partial class Program;
