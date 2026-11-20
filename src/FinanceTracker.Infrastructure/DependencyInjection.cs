using FinanceTracker.Application.Common;
using FinanceTracker.Application.Statements;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.Infrastructure.Statements;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.Infrastructure;

public static class DependencyInjection
{
    /// <summary>Registers everything this layer implements. Called once by the Api (composition root).</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        // Every IStatementParser registered here is tried by the import, in this order.
        // Supporting a new bank = one new class + one line here.
        services.AddSingleton<IStatementParser, OfxParser>();
        services.AddSingleton<IStatementParser, NubankCardCsvParser>();

        return services;
    }
}
