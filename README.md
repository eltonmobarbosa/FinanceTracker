# FinanceTracker

Controle financeiro pessoal: importe o extrato do banco (OFX ou CSV), o sistema categoriza as transações
sozinho e mostra para onde foi o dinheiro.

**Stack:** C# / ASP.NET Core (.NET 10) · EF Core · SQL Server · Angular 22 · Chart.js

## Funcionalidades
- Cadastro e login (ASP.NET Identity + JWT), com os dados de cada usuário isolados.
- Contas correntes e cartões de crédito.
- Importação de **OFX** (qualquer banco, v1 SGML e v2 XML) e **CSV da fatura Nubank**.
- **Importação idempotente:** reimportar o mesmo arquivo não duplica nada. A garantia vem de um índice único no banco.
- **Categorização automática por regras** ("descrição contém X"), com prioridade, ignorando maiúsculas e acentos.
- **Categorização que aprende:** ao corrigir uma transação, você pode criar uma regra que já é aplicada às parecidas.
- Painel com entradas, gastos, saldo, gastos por categoria e evolução mensal. O pagamento da fatura do cartão
  não é contado duas vezes.

## Arquitetura

```
web/                             Angular (standalone, signals, zoneless)
src/
  FinanceTracker.Domain          entidades e regras de negócio puras (Categorizer, CategoryRule.Matches...)
  FinanceTracker.Application     casos de uso (importar, categorizar, relatórios) e interfaces
  FinanceTracker.Infrastructure  EF Core + SQL Server, Identity, parsers OFX/CSV
  FinanceTracker.Api             ASP.NET Core Web API (controllers, JWT, ProblemDetails)
tests/
  FinanceTracker.UnitTests       domínio e parsers (xUnit)
  FinanceTracker.IntegrationTests API real em memória + SQL Server real (WebApplicationFactory)
samples/                         extratos fictícios para testar a importação
docs/adr/                        decisões de arquitetura: o que foi escolhido, as alternativas e o porquê
```

Dependências apontando para dentro: `Api → Application → Domain`, `Infrastructure → Application`.
Os detalhes estão em [docs/adr](docs/adr).

## Como rodar

Pré-requisitos: .NET SDK 10, Node 24+, SQL Server (Express serve) na instância `.\SQLEXPRESS`.

```bash
# 1. Banco
dotnet tool restore
dotnet ef database update -p src/FinanceTracker.Infrastructure -s src/FinanceTracker.Api

# 2. Chave de assinatura do JWT (fica fora do repositório)
dotnet user-secrets set "Jwt:Key" "<uma string aleatória com 32+ caracteres>" --project src/FinanceTracker.Api

# 3. API (http://localhost:5098)
dotnet run --project src/FinanceTracker.Api --launch-profile http

# 4. Frontend (http://localhost:4200), em outro terminal
cd web && npm install && npm start
```

Abra http://localhost:4200, crie uma conta e importe os arquivos de `samples/`.

## Testes

```bash
dotnet test
```

- **Unitários:** parsers (formatos reais de banco, acentos, duplicatas no arquivo), regras e o categorizador.
- **Integração:** cadastro e login, importação e reimportação, relatório sem transferências, a "regra que aprende",
  e um usuário que não consegue ver nem alterar os dados de outro (404). Rodam contra o banco
  `FinanceTracker_Tests` (local) ou contra a variável `FINANCETRACKER_TEST_DB` (CI).

O CI (`.github/workflows/ci.yml`) roda os testes com SQL Server em container e faz o build do Angular.

## API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | devolve o JWT |
| GET/POST/DELETE | `/api/accounts` | contas |
| POST | `/api/accounts/{id}/imports` | upload do extrato (`multipart/form-data`, campo `file`) |
| GET | `/api/transactions?search=&accountId=&categoryId=&uncategorized=&from=&to=&page=` | busca paginada |
| PUT | `/api/transactions/{id}/category` | `{ categoryId, rulePattern? }` |
| GET/POST/PUT/DELETE | `/api/categories`, `/api/categories/{id}/rules` | categorias e regras |
| GET | `/api/reports/summary?from=&to=&accountId=` | totais por categoria e por mês |
| GET | `/health` | API e banco |

Erros sempre no formato [Problem Details (RFC 9457)](https://www.rfc-editor.org/rfc/rfc9457).

## Formatos suportados
| Banco | Formato | Parser |
|---|---|---|
| Qualquer banco que exporte OFX (v1 SGML ou v2 XML) | `.ofx` | `OfxParser` |
| Nubank, fatura do cartão | `.csv` (`date,title,amount`) | `NubankCardCsvParser` |

Para suportar um banco novo, basta uma classe que implemente `IStatementParser` e uma linha no registro de DI.

## Decisões de arquitetura
- [0001: Arquitetura em camadas](docs/adr/0001-arquitetura-em-camadas.md)
- [0002: SQL Server Express local em vez de Docker](docs/adr/0002-sql-server-express-local.md)
- [0003: Controllers e Problem Details](docs/adr/0003-controllers-e-problem-details.md)
- [0004: Escopo da v1](docs/adr/0004-escopo-v1.md)
- [0005: Modelo de dados e persistência](docs/adr/0005-modelo-de-dados.md)
- [0006: Parsers de extrato (OFX e CSV)](docs/adr/0006-parsers-de-extrato.md)
- [0007: Autenticação e isolamento entre usuários](docs/adr/0007-autenticacao-e-isolamento.md)
- [0008: Importação e categorização](docs/adr/0008-importacao-e-categorizacao.md)
- [0009: Frontend Angular](docs/adr/0009-frontend-angular.md)

## Convenções
- Código, nomes e commits em inglês; documentação em português.
- Extratos reais nunca entram no git (`.gitignore` na raiz). Os testes e `samples/` usam dados fictícios.
