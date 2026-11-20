using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Imports;
using FinanceTracker.Application.Reports;
using FinanceTracker.Application.Transactions;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.Application;

public static class DependencyInjection
{
    // Scoped = one instance per HTTP request, same lifetime as the DbContext they use.
    public static IServiceCollection AddApplication(this IServiceCollection services) => services
        .AddScoped<AccountService>()
        .AddScoped<CategoryService>()
        .AddScoped<ImportService>()
        .AddScoped<TransactionService>()
        .AddScoped<ReportService>();
}
