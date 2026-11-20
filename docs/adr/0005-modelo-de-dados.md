# 0005 — Modelo de dados e persistência

**Status:** aceita · **Data:** 2026-11-19

## Modelo

```
Account (UserId) 1 ──< Transaction >── 0..1 Category (UserId) 1 ──< CategoryRule
```

| Tabela | Por quê existe |
|---|---|
| `Accounts` | Conta corrente ou cartão. O extrato é importado *em* uma conta. |
| `Transactions` | Uma linha do extrato. `Amount` negativo = saída, positivo = entrada. |
| `Categories` | Categorias por usuário (cada um personaliza as suas). |
| `CategoryRules` | "Descrição contém X → categoria Y", com prioridade. |

## Decisões

**Chaves `int IDENTITY` em vez de `Guid`.**
SQL Server usa a chave primária como índice clusterizado; `int` sequencial insere sempre no fim (sem fragmentação)
e ocupa 4 bytes em vez de 16. Um `Guid` aleatório (ou até UUIDv7, que o SQL Server ordena por outros bytes)
fragmenta o índice. Segurança não vem de IDs difíceis de adivinhar: toda consulta filtra pelo usuário logado.

**`UserId` é `Guid`.** É a chave do usuário no ASP.NET Identity (fase 5, `IdentityUser<Guid>`).
O domínio só conhece o `Guid`; não referencia o Identity.

**Idempotência no banco.** Índice único `(AccountId, ExternalId)`. `ExternalId` é o `FITID` do OFX ou um hash da
linha do CSV. Uma checagem só no código ("já existe?") falharia com duas importações simultâneas; o índice não.

**Dinheiro: `decimal(18,2)`, sem Value Object `Money`.** Só existe uma moeda (BRL) na v1. `float/double` estão
proibidos para dinheiro (0.1 + 0.2 ≠ 0.3). A precisão é definida uma vez em `ConfigureConventions`.

**Data: `DateOnly` → coluna `date`.** Extrato bancário tem dia, não hora; `DateTime` traria fuso horário
como fonte de bug.

**Entidades encapsuladas.** Setters privados e construtor que valida invariantes (nome obrigatório, tamanho máximo).
Um objeto inválido não chega a existir. O construtor privado vazio existe só para o EF Core.

**Mapeamento fora do domínio.** Configuração do EF em `Infrastructure/Persistence/Configurations`
(`IEntityTypeConfiguration<T>`), uma classe por tabela. O domínio não tem atributos de EF (`[Key]`, `[MaxLength]`);
os limites são constantes no domínio, reaproveitadas pela validação e pelo mapeamento (DRY).

**Exclusões.**
- Conta → transações: `CASCADE`.
- Categoria → regras: `CASCADE`.
- Categoria → transações: `NO ACTION`. O SQL Server proíbe dois caminhos de cascata até a mesma tabela
  (usuário → conta → transação e usuário → categoria → transação). A aplicação limpa `CategoryId` antes de
  excluir uma categoria.

**Sem navegações nas entidades** (`Transaction.Category` etc.). As relações são configuradas só pelas FKs.
Navegações entram quando uma consulta realmente precisar delas.
*Atualização:* `Category.Rules` entrou com o ADR 0008 — a categoria é dona das regras.

**Usuários (ADR 0007):** `Accounts.UserId` e `Categories.UserId` são FKs para `AspNetUsers` com `CASCADE`.

## Alternativas consideradas
- **Data Annotations nas entidades:** mais rápido de escrever, mas acopla o domínio ao EF. Descartado.
- **Categorias globais + categorias do usuário:** exige `UserId` nulo e regras de "quem pode editar". Descartado:
  cada usuário recebe uma cópia das categorias padrão ao se cadastrar (fase 5).
