# 0008 — Importação e categorização

**Status:** aceita · **Data:** 2026-11-19

## Importação (`ImportService`)
1. Confere que a conta é do usuário (senão 404).
2. Escolhe o primeiro `IStatementParser` cujo `CanParse` aceita o arquivo (senão 400 "formato não suportado").
3. Busca **numa única consulta** quais `ExternalId` do arquivo já existem na conta (`WHERE ExternalId IN (...)`),
   em vez de uma consulta por linha.
4. Categoriza as novas pelas regras do usuário e grava tudo num único `SaveChanges` (uma transação: ou importa
   o arquivo inteiro, ou nada).
5. Devolve o resumo `Total / Imported / Duplicates / Categorized`.

Concorrência: se o mesmo arquivo for importado duas vezes ao mesmo tempo, as duas leituras do passo 3 podem não
ver nada, mas o índice único `(AccountId, ExternalId)` rejeita a segunda gravação → HTTP 409. Sem duplicatas.

Limite de 5 MB por arquivo, aplicado antes de ler o corpo da requisição (`RequestSizeLimit`).

## Categorização
- **Regra:** "descrição contém X" (ignora maiúsculas e acentos).
- **Precedência (`Categorizer`):** maior `Priority` primeiro; empate → padrão mais longo (mais específico).
  Assim "mercado livre" vence "mercado" sem configurar nada, e "IOF de Netflix" cai em impostos porque a regra
  "iof" tem prioridade 10.
- **Aprendizado:** ao recategorizar uma transação, o usuário pode informar um padrão; o sistema cria a regra e
  aplica às transações ainda sem categoria. Mesmo `Matches()` da importação, então o resultado é idêntico.
- **Categorias padrão** no cadastro (Alimentação, Transporte, Assinaturas...), ajustadas a descrições de
  extratos brasileiros. Cada usuário recebe sua cópia e pode editar.
- **`Category` é dona das regras** (`Category.AddRule`): a regra é criada pela categoria e o EF grava as duas no
  mesmo `SaveChanges`, resolvendo o `CategoryId` gerado pelo banco.

## Transferências
Pagar a fatura do cartão aparece duas vezes: saída na conta corrente e entrada ("Pagamento recebido") no cartão.
Somar as duas contaria o mesmo dinheiro como gasto e como receita. Categorias com `IsTransfer = true`
("Transferências") ficam fora dos relatórios.

## Relatórios
`GROUP BY` e `SUM` rodam no SQL Server; só os totais trafegam. Gastos são devolvidos como números positivos.

## Erros → HTTP (`ApiExceptionHandler`)
| Exceção | Status |
|---|---|
| `NotFoundException` | 404 |
| `ConflictException`, `DbUpdateException` | 409 |
| `StatementFormatException`, `ArgumentException` (invariantes do domínio) | 400 |
| qualquer outra | 500, sem stack trace |

Os controllers não têm `try/catch`.
