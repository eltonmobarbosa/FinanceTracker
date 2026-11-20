namespace FinanceTracker.Application.Categories;

/// <summary>Starting categories and rules for a new user, tuned to Brazilian statement descriptions.</summary>
internal static class DefaultCategories
{
    // Priority 10 for taxes: "IOF de "Netflix"" is a tax even though it also contains "netflix".
    public static readonly (string Name, bool IsTransfer, (string Pattern, int Priority)[] Rules)[] All =
    [
        ("Alimentação", false, [("ifood", 0), ("restaurante", 0), ("padaria", 0), ("supermercado", 0),
            ("mercado", 0), ("lanchonete", 0), ("pizzaria", 0), ("rappi", 0), ("acougue", 0)]),
        ("Transporte", false, [("uber", 0), ("99app", 0), ("99 pop", 0), ("posto", 0), ("combustivel", 0),
            ("estacionamento", 0), ("pedagio", 0)]),
        ("Assinaturas", false, [("netflix", 0), ("spotify", 0), ("disney", 0), ("amazon prime", 0),
            ("youtube", 0), ("hbo", 0), ("anthropic", 0), ("openai", 0), ("google one", 0), ("apple.com", 0)]),
        ("Compras", false, [("mercado livre", 0), ("shopee", 0), ("amazon", 0), ("magalu", 0), ("renner", 0),
            ("riachuelo", 0), ("c&a", 0), ("puma", 0), ("nike", 0), ("shein", 0), ("aliexpress", 0)]),
        ("Saúde", false, [("farmacia", 0), ("drogaria", 0), ("drogasil", 0), ("droga raia", 0), ("hospital", 0),
            ("clinica", 0), ("laboratorio", 0), ("unimed", 0)]),
        ("Educação", false, [("universidade", 0), ("faculdade", 0), ("estacio", 0), ("udemy", 0),
            ("alura", 0), ("curso", 0), ("escola", 0)]),
        ("Moradia", false, [("aluguel", 0), ("condominio", 0), ("enel", 0), ("energia", 0), ("sabesp", 0),
            ("agua", 0), ("internet", 0), ("vivo", 0), ("claro", 0)]),
        ("Impostos e taxas", false, [("iof", 10), ("juros", 10), ("tarifa", 10), ("anuidade", 10), ("multa", 10)]),
        ("Salário", false, [("salario", 0), ("pagamento de salario", 0), ("folha", 0)]),
        ("Transferências", true, [("pagamento recebido", 20), ("pagamento de fatura", 20),
            ("pagamento fatura", 20)]),
    ];
}
