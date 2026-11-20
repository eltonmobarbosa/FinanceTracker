using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FinanceTracker.Api.Auth;
using FinanceTracker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests;

/// <summary>
/// Starts the real API in memory against a real SQL Server database (ADR 0002).
/// Locally: FinanceTracker_Tests on .\SQLEXPRESS. CI: the FINANCETRACKER_TEST_DB environment variable.
/// The database is recreated once per test run; each test registers its own user, so tests do not share data.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private static readonly string ConnectionString =
        Environment.GetEnvironmentVariable("FINANCETRACKER_TEST_DB")
        ?? @"Server=.\SQLEXPRESS;Database=FinanceTracker_Tests;Trusted_Connection=True;TrustServerCertificate=True";

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", ConnectionString);
        builder.UseSetting("Jwt:Key", "integration-tests-only-key-0123456789-abcdefghij");
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync(); // also proves the migrations apply on an empty database
    }

    Task IAsyncLifetime.DisposeAsync() => Task.CompletedTask;

    /// <summary>A client already authenticated as a brand-new user.</summary>
    public async Task<HttpClient> CreateUserClientAsync()
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register",
            new { email = $"{Guid.NewGuid():N}@test.local", password = "Senha-forte-123" });
        response.EnsureSuccessStatusCode();

        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }
}

[CollectionDefinition(nameof(ApiCollection))]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>;
