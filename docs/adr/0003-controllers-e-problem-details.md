# 0003 — Controllers e erros no formato Problem Details

**Status:** aceita · **Data:** 2026-11-19

## Contexto
A API precisa expor endpoints REST para o frontend Angular e responder erros de forma previsível.

## Decisão
- **Controllers** (`[ApiController]`), um por recurso (`TransactionsController`, `ImportsController`...).
- Toda resposta de erro segue a **RFC 9457 (Problem Details)**, `Content-Type: application/problem+json`,
  via `AddProblemDetails()` + `UseExceptionHandler()` + `UseStatusCodePages()`.
- `/health` expõe um health check (o check do banco entra na fase 2).

## Alternativas consideradas
- **Minimal APIs:** menos código por endpoint e mais performáticas. Descartado por preferência de mercado:
  controllers ainda são o padrão mais comum nas bases .NET corporativas, e o `[ApiController]` dá validação
  automática de modelo (400 com detalhes) sem configuração extra. A diferença de performance é irrelevante aqui.
- **Formato de erro próprio** (`{ "error": "..." }`): reinventa um padrão que já existe e que o ASP.NET gera sozinho.

## Consequências
- O frontend trata todos os erros com um único interceptor HTTP.
- Exceções não tratadas viram 500 sem vazar stack trace.
