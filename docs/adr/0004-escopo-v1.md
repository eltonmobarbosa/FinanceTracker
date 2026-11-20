# 0004 — Escopo da versão 1

**Status:** aceita · **Data:** 2026-11-19

## Dentro do escopo
- Multiusuário com login; cada usuário só enxerga os próprios dados.
- Importação de extratos **OFX** e **CSV** de conta corrente e cartão de crédito.
- Bancos-alvo dos testes: **Nubank**, **Itaú** (OFX/CSV).
- Importação idempotente: reimportar o mesmo arquivo não duplica transações.
- Categorização automática por regras + recategorização manual (que pode virar regra nova).
- Dashboard: gastos por categoria e por mês.

## Fora do escopo (por enquanto)
- **Extratos em PDF** (ex.: PicPay, se não exportar OFX/CSV): parsear PDF é frágil e depende do layout do banco.
- **Investimentos (XP):** posições, cotas e rentabilidade são outro domínio. Na v1 só entra movimentação de conta.
- **Open Finance / integração direta com bancos:** exige certificação regulatória.
- **Categorização por Machine Learning:** sem dados de treino; regras são determinísticas e explicáveis.
