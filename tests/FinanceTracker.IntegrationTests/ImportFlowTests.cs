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
        Assert.NotNull(first.ImportId);
        Assert.Equal(new ImportResult(Total: 5, Imported: 5, Duplicates: 0, Categorized: 2, first.ImportId), first);
        Assert.Equal(new ImportResult(Total: 5, Imported: 0, Duplicates: 5, Categorized: 0), second);
    }

    [Fact]
    public async Task Undo_removes_only_the_rows_of_that_import()
    {
        var client = await api.CreateUserClientAsync();
        var account = await CreateCardAsync(client);
        await ImportAsync(client, account.Id, "date,title,amount\n2026-10-01,Antiga,\"10,00\"");
        var second = await ImportAsync(client, account.Id, "date,title,amount\n2026-10-02,Nova,\"20,00\"");

        var undo = await client.DeleteAsync($"/api/accounts/{account.Id}/imports/{second.ImportId}");
        var again = await client.DeleteAsync($"/api/accounts/{account.Id}/imports/{second.ImportId}");

        var left = (await client.GetFromJsonAsync<PagedResult<TransactionDto>>("/api/transactions", ApiFactory.Json))!;
        Assert.Equal(HttpStatusCode.NoContent, undo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
        Assert.Equal("Antiga", Assert.Single(left.Items).Description);
    }

    [Fact]
    public async Task Card_refund_reduces_spending_instead_of_counting_as_income()
    {
        var client = await api.CreateUserClientAsync();
        var account = await CreateCardAsync(client);
        await ImportAsync(client, account.Id,
            "date,title,amount\n2026-10-01,Loja X,\"100,00\"\n2026-10-05,Estorno Loja X,\"- 40,00\"");

        var summary = (await client.GetFromJsonAsync<SummaryDto>("/api/reports/summary", ApiFactory.Json))!;

        Assert.Equal(0m, summary.Income);
        Assert.Equal(60m, summary.Expenses);
    }

    [Fact]
    public async Task Payment_received_on_a_checking_account_is_income_not_a_transfer()
    {
        var client = await api.CreateUserClientAsync();
        var response = await client.PostAsJsonAsync("/api/accounts",
            new CreateAccountRequest("Corrente", AccountType.Checking), ApiFactory.Json);
        var account = (await response.Content.ReadFromJsonAsync<AccountDto>(ApiFactory.Json))!;

        await ImportAsync(client, account.Id, "date,title,amount\n2026-10-01,Pagamento recebido cliente,\"- 500,00\"");

        var summary = (await client.GetFromJsonAsync<SummaryDto>("/api/reports/summary", ApiFactory.Json))!;
        Assert.Equal(500m, summary.Income);
    }

    [Fact]
    public async Task Search_ignores_accents()
    {
        var client = await api.CreateUserClientAsync();
        var account = await CreateCardAsync(client);
        await ImportAsync(client, account.Id, "date,title,amount\n2026-10-01,Padaria São João,\"10,00\"");

        var page = (await client.GetFromJsonAsync<PagedResult<TransactionDto>>(
            "/api/transactions?search=sao%20joao", ApiFactory.Json))!;

        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public async Task Same_rule_text_cannot_be_created_twice()
    {
        var client = await api.CreateUserClientAsync();
        var categories = (await client.GetFromJsonAsync<List<CategoryDto>>("/api/categories", ApiFactory.Json))!;
        var food = categories.Single(c => c.Name == "Alimentação");

        var response = await client.PostAsJsonAsync($"/api/categories/{food.Id}/rules",
            new CreateRuleRequest("UBER"), ApiFactory.Json); // already a "Transporte" rule

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Database_failure_is_not_reported_as_a_conflict()
    {
        var client = await api.CreateUserClientAsync();
        var account = await CreateCardAsync(client);

        var response = await PostFileAsync(client, account.Id, "f.csv",
            "date,title,amount\n2026-10-01,Enorme,\"9999999999999999999,00\""); // does not fit decimal(18,2)

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
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
