# 0007 — Autenticação (Identity + JWT) e isolamento entre usuários

**Status:** aceita · **Data:** 2026-11-19

## Decisão

**ASP.NET Core Identity para usuários, JWT para a sessão.**
- Identity guarda usuários e hash de senha (PBKDF2), valida senha e faz *lockout* (5 erros = 5 min bloqueado).
- `AddIdentityCore` (sem cookies nem UI do Identity) + `AuthController` próprio com `register` e `login`.
- O login devolve um JWT assinado (HMAC-SHA256) com `sub` = id do usuário; validade de 8 h.
- A chave do JWT **não está no repositório**: em dev vem do `dotnet user-secrets`; em produção, da variável
  `Jwt__Key`. A API valida as opções na inicialização (`ValidateOnStart`) e não sobe sem chave.
- Login com e-mail inexistente e com senha errada devolve a mesma resposta (não revela quais e-mails existem).

**Seguro por padrão.** `FallbackPolicy = RequireAuthenticatedUser`: todo endpoint exige token, exceto os marcados
com `[AllowAnonymous]` (`/api/auth/*`, `/health`). Um endpoint novo esquecido nasce protegido.

**Isolamento entre usuários.**
- Toda consulta dos casos de uso parte de `OwnedAccounts / OwnedCategories / OwnedRules / OwnedTransactions`
  (`Application/Common/Ownership.cs`). A regra "só os dados do usuário logado" está escrita uma vez.
- Recurso de outro usuário responde **404, não 403**: não confirma nem que o id existe.
- Coberto por teste de integração (`SecurityTests.A_user_cannot_see_or_touch_another_users_data`).

**Cadastro atômico.** Usuário e categorias padrão são gravados na mesma transação de banco.

## Alternativas consideradas
- **`MapIdentityApi` (endpoints prontos do .NET 8+):** menos código, mas o token é opaco (não é JWT) e não há
  como semear as categorias padrão na mesma transação do cadastro. Descartado.
- **Cookie httpOnly em vez de JWT no `localStorage`:** mais resistente a XSS (o JavaScript não lê o cookie), mas
  exige proteção CSRF e configuração de domínio. Para a v1 o JWT é suficiente; o Angular escapa HTML por padrão,
  o que reduz o risco de XSS. Revisitar antes de produção real.
- **Refresh token:** fora da v1. Após 8 h o usuário faz login de novo.
- **Global Query Filter do EF por usuário:** isolaria automaticamente, mas `Transaction` não tem `UserId`
  (chega pelo `Account`) e filtros globais escondem a regra de quem lê a consulta. Preferimos filtros explícitos.
