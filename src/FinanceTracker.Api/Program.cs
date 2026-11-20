using FinanceTracker.Infrastructure;
using FinanceTracker.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Dev: appsettings.Development.json. Production: environment variable ConnectionStrings__Default.
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

builder.Services.AddInfrastructure(connectionString);
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Every error response (validation, 404, unhandled exception) uses the RFC 9457 "problem details" JSON format,
// so the Angular client handles errors in one place.
builder.Services.AddProblemDetails();

// /health also opens a connection to SQL Server: "Healthy" means the API can reach the database.
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();

var app = builder.Build();

// Unhandled exceptions become a 500 ProblemDetails without leaking the stack trace.
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
