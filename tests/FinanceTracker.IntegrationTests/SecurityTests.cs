using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FinanceTracker.Api.Auth;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Accounts;
using Microsoft.AspNetCore.Hosting;

namespace FinanceTracker.IntegrationTests;

[Collection(nameof(ApiCollection))]
public sealed class SecurityTests(ApiFactory api)
{
    [Theory]
    [InlineData("/api/accounts")]
    [InlineData("/api/transactions")]
    [InlineData("/api/reports/summary")]
    public async Task Endpoints_require_a_token(string url)
    {
        var response = await api.CreateClient().GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Health_is_public() =>
        Assert.Equal(HttpStatusCode.OK, (await api.CreateClient().GetAsync("/health")).StatusCode);

    [Fact]
    public async Task Login_with_wrong_password_returns_401_and_right_password_returns_token()
    {
        var client = api.CreateClient();
        var email = $"{Guid.NewGuid():N}@test.local";
        (await client.PostAsJsonAsync("/api/auth/register", new { email, password = "Senha-forte-123" }))
            .EnsureSuccessStatusCode();

        var wrong = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "errada-123" });
        var right = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "Senha-forte-123" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(HttpStatusCode.OK, right.StatusCode);
    }

    [Fact]
    public async Task Register_rejects_short_password()
    {
        var response = await api.CreateClient().PostAsJsonAsync("/api/auth/register",
            new { email = $"{Guid.NewGuid():N}@test.local", password = "123" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task New_user_gets_default_categories()
    {
        var client = await api.CreateUserClientAsync();

        var categories = (await client.GetFromJsonAsync<List<CategoryDto>>("/api/categories", ApiFactory.Json))!;

        Assert.Contains(categories, c => c is { Name: "Transferências", IsTransfer: true });
        Assert.All(categories, c => Assert.NotEmpty(c.Rules));
    }

    [Fact]
    public async Task Delete_profile_needs_the_password_and_removes_all_data()
    {
        var client = api.CreateClient();
        var email = $"{Guid.NewGuid():N}@test.local";
        var auth = (await (await client.PostAsJsonAsync("/api/auth/register", new { email, password = "Senha-forte-123" }))
            .Content.ReadFromJsonAsync<AuthResponse>(ApiFactory.Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var account = (await (await client.PostAsJsonAsync("/api/accounts",
                new CreateAccountRequest("Conta", AccountType.CreditCard), ApiFactory.Json))
            .Content.ReadFromJsonAsync<AccountDto>(ApiFactory.Json))!;
        // "Uber" gets a category, so the row references a category that is deleted too.
        await ImportFlowTests.PostFileAsync(client, account.Id, "f.csv", "date,title,amount\n2026-10-01,Uber,\"10,00\"");

        var wrong = await DeleteProfileAsync(client, "errada-123");
        var right = await DeleteProfileAsync(client, "Senha-forte-123");
        var login = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password = "Senha-forte-123" });

        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, right.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    private static Task<HttpResponseMessage> DeleteProfileAsync(HttpClient client, string password) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/auth/me") { Content = JsonContent.Create(new { password }) });

    [Fact]
    public async Task Delete_profile_requires_a_token()
    {
        var response = await DeleteProfileAsync(api.CreateClient(), "qualquer");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Production_limits_login_attempts()
    {
        var client = api.WithWebHostBuilder(b => b.UseEnvironment("Production")).CreateClient();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 11; i++)
            statuses.Add((await client.PostAsJsonAsync("/api/auth/login",
                new { email = "ninguem@test.local", password = "errada-123" })).StatusCode);

        Assert.All(statuses.Take(10), s => Assert.Equal(HttpStatusCode.Unauthorized, s));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[10]);
    }

    [Fact]
    public async Task A_user_cannot_see_or_touch_another_users_data()
    {
        var alice = await api.CreateUserClientAsync();
        var bob = await api.CreateUserClientAsync();

        var aliceAccount = (await (await alice.PostAsJsonAsync("/api/accounts",
                new CreateAccountRequest("Conta da Alice", AccountType.Checking), ApiFactory.Json))
            .Content.ReadFromJsonAsync<AccountDto>(ApiFactory.Json))!;
        await ImportFlowTests.PostFileAsync(alice, aliceAccount.Id, "f.csv", "date,title,amount\n2026-10-01,Uber,\"10,00\"");

        // 404, not 403: Bob must not even learn that the account id exists.
        var importIntoAlice = await ImportFlowTests.PostFileAsync(bob, aliceAccount.Id, "f.csv", "date,title,amount\n");
        var deleteAlice = await bob.DeleteAsync($"/api/accounts/{aliceAccount.Id}");
        var bobAccounts = (await bob.GetFromJsonAsync<List<AccountDto>>("/api/accounts", ApiFactory.Json))!;
        var bobTransactions = (await bob.GetFromJsonAsync<PagedResult<TransactionDto>>("/api/transactions", ApiFactory.Json))!;

        Assert.Equal(HttpStatusCode.NotFound, importIntoAlice.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, deleteAlice.StatusCode);
        Assert.Empty(bobAccounts);
        Assert.Equal(0, bobTransactions.TotalCount);
    }
}
