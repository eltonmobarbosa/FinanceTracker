# 0009 — Frontend Angular

**Status:** aceita · **Data:** 2026-11-19

## Decisão

**Angular 22 com o padrão atual do framework:** standalone components (sem `NgModule`), signals,
*zoneless* (sem zone.js; a tela atualiza quando um signal muda) e o novo controle de fluxo (`@if`, `@for`).

**Leitura com `httpResource`, escrita com `HttpClient`.**
`httpResource(() => ({ url, params }))` é um signal que refaz a requisição sozinho quando os signals usados
dentro dele mudam. Os filtros de transações e o período do painel são signals; trocar um filtro = nova busca,
sem `subscribe` manual nem gerenciamento de `Subscription`. Mutações (criar, importar, categorizar) usam
`HttpClient` e chamam `.reload()` no recurso afetado.

**Um interceptor HTTP para tudo.** `apiInterceptor` adiciona o JWT e transforma qualquer erro em notificação,
lendo o ProblemDetails da API (ADR 0003). As páginas não têm tratamento de erro próprio. 401 fora do login
desloga e volta para a tela de entrada.

**Um serviço por API (`FinanceApi`)**, não um por recurso: a API é pequena, e assim todos os endpoints ficam
num arquivo só.

**Proxy de desenvolvimento** (`proxy.conf.json`): o `ng serve` repassa `/api` para a API em `localhost:5098`.
O navegador vê uma única origem, então não há CORS para configurar. Em produção, o mesmo efeito vem de servir
o build do Angular e a API atrás do mesmo domínio (reverse proxy).

**Sem biblioteca de componentes** (Angular Material, PrimeNG). *Atualizado pelo ADR 0010:* o estilo segue o padrão
shadcn/ui com Tailwind. **Chart.js** direto, com um wrapper de 30 linhas (`shared/chart.ts`), em vez de `ng2-charts`.

**Páginas *lazy-loaded*.** Cada página é um chunk separado; o Chart.js (~200 kB) só é baixado ao abrir o painel.

**Localização pt-BR:** `LOCALE_ID = pt-BR` e moeda `BRL` (`R$ 1.234,56`). Datas `YYYY-MM-DD` são formatadas
por um pipe próprio (`brDate`): o `DatePipe` interpreta data sem hora como meia-noite UTC e, no Brasil (UTC-3),
mostraria o dia anterior.

**Categorização que aprende (UX):** ao trocar a categoria de uma transação, a tela sugere um padrão (descrição
sem números e sem "Parcela x/y") e pergunta se deve criar a regra e aplicar às parecidas.

## Alternativas consideradas
- **NgRx / store global:** o estado é quase todo "resposta do servidor"; `httpResource` + signals cobrem sem
  boilerplate de actions/reducers.
- **Reactive Forms em todas as telas:** usado no login (validação); nos filtros, signals + `ngModel` são mais diretos.
