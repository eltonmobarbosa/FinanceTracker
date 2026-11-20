using System.Net;
using System.Net.Http.Json;
using System.Text;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Imports;
using FinanceTracker.Application.Reports;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Accounts;

namespace FinanceTracker.IntegrationTests;

[Collection(nameof(ApiCollection))]
public sealed class ImportFlowTests(ApiFactory api)
{
    // Fictitious data in the real Nubank card layout.
    private const string NubankCsv = """"
        date,title,amount
        2026-10-16,Streaming Plus,"69,90"
        2026-10-14,Pix no Crédito - Fulano de Tal,"2.220,66"
        2026-10-13,"IOF de ""Loja* Assinatura""","4,00"
        2026-10-08,Pagamento recebido,"- 3.520,94"
        2026-09-16,Streaming Plus,"69,90"
        """";

    [Fact]
    public async Task Import_categorizes_and_reimport_skips_duplicates()
    {
        var client = await api.CreateUserClientAsync();
        var account = await CreateCardAsync(client);

        var first = await ImportAsync(client, account.Id, NubankCsv);
        var second = await ImportAsync(client, account.Id, NubankCsv);

        // IOF -> "Impostos e taxas", "Pagamento recebido" -> "Transferências" (default rules).
        Assert.Equal(new ImportResult(Total: 5, Imported: 5, Duplicates: 0, Categorized: 2), first);
        Assert.Equal(new ImportResult(Total: 5, Imported: 0, Duplicates: 5, Categorized: 0), second);
    }

    [Fact]
    public async Task Report_ignores_transfers_and_reports_expenses_as_positive()
    {
        var client = await api.CreateUserClientAsync();
        var account = await CreateCardAsync(client);
        await ImportAsync(client, account.Id, NubankCsv);

        var summary = (await client.GetFromJsonAsync<SummaryDto>("/api/reports/summary", ApiFactory.Json))!;

        // The card bill payment (+3520.94) is a transfer, not income.
        Assert.Equal(0m, summary.Income);
        Assert.Equal(69.90m + 2220.66m + 4.00m + 69.90m, summary.Expenses);
        Assert.Equal([(2026, 9), (2026, 10)], summary.ByMonth.Select(m => (m.Year, m.Month)));
        Assert.Contains(summary.ExpensesByCategory, c => c is { Name: "Impostos e taxas", Total: 4.00m });
    }

    [Fact]
    public async Task Categorizing_with_a_rule_also_categorizes_similar_transactions()
    {
        var client = await api.CreateUserClientAsync();
        var account = await CreateCardAsync(client);
        await ImportAsync(client, account.Id, NubankCsv);

        var categories = (await client.GetFromJsonAsync<List<CategoryDto>>("/api/categories", ApiFactory.Json))!;
        var subscriptions = categories.Single(c => c.Name == "Assinaturas");
        var page = (await client.GetFromJsonAsync<PagedResult<TransactionDto>>(
            "/api/transactions?search=streaming", ApiFactory.Json))!;

        var response = await client.PutAsJsonAsync($"/api/transactions/{page.Items[0].Id}/category",
            new CategorizeRequest(subscriptions.Id, RulePattern: "streaming"), ApiFactory.Json);

        var result = (await response.Content.ReadFromJsonAsync<CategorizeResult>(ApiFactory.Json))!;
        Assert.Equal(1, result.AlsoCategorized); // the other "Streaming Plus" month

        var stillUncategorized = (await client.GetFromJsonAsync<PagedResult<TransactionDto>>(
            "/api/transactions?search=streaming&uncategorized=true", ApiFactory.Json))!;
        Assert.Equal(0, stillUncategorized.TotalCount);
    }

    [Fact]
    public async Task Unsupported_file_returns_400_problem_details()
    {
        var client = await api.CreateUserClientAsync();
        var account = await CreateCardAsync(client);

        var response = await PostFileAsync(client, account.Id, "extrato.txt", "qualquer coisa");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private static async Task<AccountDto> CreateCardAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/accounts",
            new CreateAccountRequest("Nubank Cartão", AccountType.CreditCard), ApiFactory.Json);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AccountDto>(ApiFactory.Json))!;
    }

    private static async Task<ImportResult> ImportAsync(HttpClient client, int accountId, string csv)
    {
        var response = await PostFileAsync(client, accountId, "Nubank_2026-10.csv", csv);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ImportResult>(ApiFactory.Json))!;
    }

    internal static Task<HttpResponseMessage> PostFileAsync(HttpClient client, int accountId, string name, string text)
    {
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(Encoding.UTF8.GetBytes(text)), "file", name },
        };
        return client.PostAsync($"/api/accounts/{accountId}/imports", form);
    }
}
