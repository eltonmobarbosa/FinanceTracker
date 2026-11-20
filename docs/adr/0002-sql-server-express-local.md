# 0002 — SQL Server Express local em vez de Docker

**Status:** aceita · **Data:** 2026-11-19

## Contexto
O plano original usava SQL Server em container (docker-compose) e Testcontainers nos testes de integração.
A máquina de desenvolvimento não tem virtualização disponível, então o Docker não roda.

## Decisão
- Desenvolvimento usa **SQL Server 2025 Express** instalado no Windows, instância `.\SQLEXPRESS`.
- Autenticação do Windows (`Trusted_Connection=True`): não existe senha no repositório.
- `TrustServerCertificate=True` apenas no ambiente de desenvolvimento (certificado autoassinado local).
- Testes de integração leem a connection string de variável de ambiente:
  localmente apontam para um banco `FinanceTracker_Tests` descartável; no CI (GitHub Actions, que tem Docker)
  apontam para um SQL Server em container.

## Alternativas consideradas
- **LocalDB:** mais leve, mas sobe sob demanda e se comporta diferente de um serviço real. Descartado.
- **SQLite em dev:** dialeto SQL diferente do de produção; bugs só apareceriam no SQL Server. Descartado.
- **Banco na nuvem (Azure SQL):** custo e dependência de rede para desenvolver. Descartado.

## Consequências
- Mesmo motor (SQL Server) em dev, CI e produção.
- O setup local exige um passo manual de instalação (documentado no README).

## Nota de instalação
A instalação silenciosa via `winget` falhou (`0x84C4000E`) sem gerar log. Pelo assistente gráfico funcionou
desmarcando **Azure Extension for SQL Server** e selecionando apenas **Database Engine Services**.
