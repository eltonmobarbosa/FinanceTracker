# FinanceTracker

Controle financeiro pessoal: importe o extrato do banco (OFX ou CSV), o sistema categoriza as transações
sozinho e mostra para onde foi o dinheiro.

**Stack:** C# / ASP.NET Core (.NET 10) · SQL Server · Angular

## Estrutura

```
src/
  FinanceTracker.Domain          entidades e regras de negócio puras
  FinanceTracker.Application     casos de uso e interfaces
  FinanceTracker.Infrastructure  EF Core, SQL Server, parsers OFX/CSV
  FinanceTracker.Api             ASP.NET Core Web API (composition root)
tests/
  FinanceTracker.UnitTests       testes unitários (xUnit)
docs/adr/                        decisões de arquitetura (por que cada escolha foi feita)
Directory.Build.props            configurações comuns a todos os projetos
Directory.Packages.props         versões de pacotes NuGet, centralizadas
```

## Como rodar

Pré-requisitos: .NET SDK 10 e SQL Server (Express serve) com a instância `.\SQLEXPRESS`.

```bash
dotnet tool restore                      # instala o dotnet-ef (versão fixada em dotnet-tools.json)
dotnet ef database update -p src/FinanceTracker.Infrastructure -s src/FinanceTracker.Api
dotnet run --project src/FinanceTracker.Api --launch-profile http
# http://localhost:5098/health  ->  Healthy (API no ar e banco acessível)
```

Testes: `dotnet test`

Nova migration (após mudar entidades ou configurações):

```bash
dotnet ef migrations add <Nome> -p src/FinanceTracker.Infrastructure -s src/FinanceTracker.Api -o Persistence/Migrations
```

## Convenções
- Código, nomes e commits em inglês (padrão de mercado); documentação em português.
- Cada decisão relevante de arquitetura vira um ADR em `docs/adr/`.

## Decisões de arquitetura
- [0001 — Arquitetura em camadas](docs/adr/0001-arquitetura-em-camadas.md)
- [0002 — SQL Server Express local em vez de Docker](docs/adr/0002-sql-server-express-local.md)
- [0003 — Controllers e Problem Details](docs/adr/0003-controllers-e-problem-details.md)
- [0004 — Escopo da v1](docs/adr/0004-escopo-v1.md)
- [0005 — Modelo de dados e persistência](docs/adr/0005-modelo-de-dados.md)
