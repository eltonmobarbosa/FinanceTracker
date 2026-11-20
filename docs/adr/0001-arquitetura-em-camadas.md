# 0001 — Arquitetura em camadas (Clean Architecture enxuta)

**Status:** aceita · **Data:** 2026-11-19

## Contexto
O núcleo do sistema é lógica pura: ler extratos (OFX/CSV), evitar duplicatas e categorizar transações.
Essa lógica precisa ser testável sem banco de dados e não pode depender de detalhes como EF Core ou HTTP.

## Decisão
Quatro projetos, com dependências apontando sempre para dentro:

```
Api ──► Application ──► Domain
 │            ▲
 └──► Infrastructure
```

| Projeto | Responsabilidade | Depende de |
|---|---|---|
| `Domain` | Entidades e regras de negócio puras (`Transaction`, `Category`...) | nada |
| `Application` | Casos de uso (importar extrato, categorizar) e interfaces que eles precisam (`IStatementParser`...) | Domain |
| `Infrastructure` | Implementações técnicas: EF Core, SQL Server, parsers de arquivo | Application |
| `Api` | HTTP: controllers, autenticação, *composition root* (registra a DI) | Application, Infrastructure |

A `Api` referencia `Infrastructure` **somente** para registrar as implementações na injeção de dependência.

## Alternativas consideradas
- **Projeto único / Vertical Slice:** menos arquivos e menos cerimônia. Descartado porque o domínio tem lógica
  que vale isolar, e vagas .NET/SQL Server costumam esperar separação em camadas.
- **CQRS + MediatR:** adiciona uma indireção por caso de uso sem ganho aqui (sem escala de leitura/escrita
  distinta, sem pipeline de comportamentos complexo). Descartado.
- **Repository genérico sobre EF Core:** o `DbContext` já é Unit of Work e cada `DbSet` já é um repositório.
  Uma camada genérica em cima só esconde recursos do EF. Descartado: a Application usa uma interface
  enxuta do contexto (definida na fase 2).

## Consequências
- Regras de negócio testáveis com testes unitários rápidos, sem banco.
- Trocar o banco ou um parser não afeta o domínio.
- Custo: mais projetos e referências para manter do que um projeto único.
