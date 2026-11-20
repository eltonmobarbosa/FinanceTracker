# 0006 — Parsers de extrato (OFX e CSV)

**Status:** aceita · **Data:** 2026-11-19

## Contexto
Cada banco exporta um layout diferente. A importação precisa transformar qualquer um deles na mesma
lista de transações, com sinal padronizado (negativo = saída) e um `ExternalId` estável para a idempotência
(ADR 0005).

## Decisão

**Strategy.** `IStatementParser` (na `Application`) com `CanParse(fileName, content)` e `Parse(content)`.
Cada layout é uma classe na `Infrastructure`: `OfxParser`, `NubankCardCsvParser`. Banco novo = classe nova;
o caso de uso de importação (fase 4) não muda — princípio Aberto/Fechado.

**Detecção pelo conteúdo, não só pela extensão.** Um `.csv` do cartão Nubank e um `.csv` da conta Nubank têm
colunas diferentes; o parser confere o cabeçalho.

**Uma classe por layout, em vez de "perfil de colunas configurável".** O plano inicial previa um CSV genérico
configurado por banco. Ao ver o arquivo real, cada layout tem regras que não são só "qual coluna é qual":
sinal invertido no cartão, formato `"- 3.520,94"`, aspas escapadas. Configuração para isso vira uma mini-linguagem.
Classes pequenas e testadas são mais simples. Revisitar se surgirem muitos bancos com layouts quase iguais.

**`ExternalId`.**
- OFX: `FITID`, o id que o próprio banco dá à transação.
- CSV sem id: SHA-256 de `data|valor|descrição`.
- Nos dois casos, uma chave repetida *dentro do mesmo arquivo* vira `chave#1`, `chave#2`...
  Duas compras idênticas no mesmo dia (dois cafés de R$ 8,00) são preservadas, e reimportar o mesmo arquivo
  gera os mesmos ids — continua idempotente. Também protege contra bancos que repetem `FITID`.
- Limitação conhecida: se o banco mudar a descrição de uma transação entre duas exportações, o hash muda
  e ela entra duplicada. Aceito para a v1.

**Sem bibliotecas de terceiros.**
- CSV: `Microsoft.VisualBasic.FileIO.TextFieldParser`, que já vem no .NET e trata aspas e vírgulas dentro de campos.
  `string.Split(',')` quebraria em `"IOF de ""Loja"""` e em `"2.220,66"`.
- OFX: o v1 é SGML (tags de valor sem fechamento), não é XML válido. Um parser por regex lendo `<TAG>valor`
  até o próximo `<` ou quebra de linha cobre o v1 e o v2 (XML) com ~100 linhas testadas.
- Charset: OFX de bancos brasileiros costuma declarar `CHARSET:1252`; o .NET só suporta Windows-1252 após
  registrar `CodePagesEncodingProvider`.

**Erros.** Arquivo reconhecido mas quebrado lança `StatementFormatException` com mensagem em português e o
número da linha/transação — segura para mostrar ao usuário (vira HTTP 400 na fase 4).

## Alternativas consideradas
- **CsvHelper / OfxSharp (NuGet):** resolvem, mas adicionam dependências para pouco código; o `OfxSharp` e
  similares têm manutenção irregular e não tratam todas as variações dos bancos brasileiros.
- **Parsear PDF (Itaú):** fora de escopo (ADR 0004).

## Privacidade
Extratos reais têm nomes e dados de terceiros (destinatários de Pix). Ficam fora do git (`.gitignore` ignora
`/*.csv`, `/*.ofx`, `/*.pdf` na raiz). Os testes usam dados fictícios no mesmo layout.
