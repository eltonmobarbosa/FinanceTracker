var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Every error response (validation, 404, unhandled exception) uses the RFC 9457 "problem details" JSON format,
// so the Angular client handles errors in one place.
builder.Services.AddProblemDetails();

// Liveness probe. The database check is added in phase 2, together with EF Core.
builder.Services.AddHealthChecks();

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
