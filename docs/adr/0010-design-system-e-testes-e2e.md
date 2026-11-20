# 0010 — Design system (padrão shadcn/ui) e testes end-to-end

**Status:** aceita · **Data:** 2026-11-19 · **Substitui** a parte de estilo do ADR 0009

## Contexto
A primeira interface usava CSS escrito à mão, sem sistema: cores soltas, `window.confirm()`, tabela que quebrava no
celular. Funcionava, mas não parecia um produto. Também não havia nenhum teste que clicasse na interface.

## Decisão — interface

**Linguagem visual do [shadcn/ui](https://ui.shadcn.com)** (usada por Vercel, Linear, Supabase), implementada com
**Tailwind CSS v4**:
- *Design tokens* semânticos em `styles.css` (`background`, `muted`, `primary`, `positive`...) em OKLCH, com
  valores para tema claro e escuro. Componentes só usam os nomes semânticos, então o tema escuro é outro conjunto
  de valores, não outro CSS.
- Peças reutilizáveis como classes (`.btn`, `.input`, `.card`, `.badge`, `.segmented`) — o equivalente aos
  componentes do shadcn, sem copiar código React.
- Fonte Inter, ícones [Lucide](https://lucide.dev) (os mesmos do shadcn).

**Padrões de UX de apps de finanças (Copilot Money, Mobills, apps de banco):**
- Gasto em cor neutra e entrada em verde: vermelho em toda linha vira ruído.
- Períodos rápidos (Este mês, 3/6/12 meses) em vez de dois campos de data.
- Cor estável por categoria (gráfico, tabela e página de categorias usam a mesma); transferências em cinza.
- Taxa de economia, aviso de "N transações sem categoria → Revisar", onboarding quando não há dados.
- No celular, cada transação vira um bloco de 2 linhas (descrição + valor / categoria + data), sem rolagem lateral.

**Componentes próprios pequenos em vez de bibliotecas:**
- `Modal`: diretiva sobre o `<dialog>` nativo. `showModal()` já dá *focus trap*, Esc e backdrop acessíveis.
- `ConfirmService`: `await confirm.ask(...)` substitui `window.confirm()` com o mesmo visual do app.
- `Icon`: desenha os ícones a partir dos dados do pacote `lucide` com `createElementNS` (sem `innerHTML`).
  O `lucide-angular` ainda não suporta Angular 22.
- `CategoryStore`: categorias carregadas uma vez e compartilhadas, recarregadas quando o usuário logado muda.

## Decisão — testes end-to-end

**Playwright** em `web/e2e/`, contra o app real (Angular + API + SQL Server):
- Cada teste cria seu próprio usuário pela API (fixture `user`) e já entra logado (`loggedIn`): testes isolados,
  rodando em paralelo.
- Seletores por papel acessível (`getByRole('button', { name: 'Excluir conta X' })`), não por classes CSS: se o
  teste encontra o botão pelo nome, um leitor de tela também encontra.
- Cobre todos os botões e fluxos: cadastro/login/erro/logout, mostrar senha, tema, navegação, períodos, filtros,
  busca, paginação, modal de categorização (salvar, só esta, cancelar, Esc), importação por clique e por arrastar,
  reimportação, arquivo inválido, criar/editar/excluir conta e categoria, regras, menu mobile e ausência de
  rolagem lateral no celular.
- `tour.spec.ts` gera os prints de todas as telas em tema claro e escuro (usados no README).

## Bugs que os testes encontraram
- **Cancelar o modal não desfazia a escolha na linha.** O modelo não mudou, então o Angular não reescreve a
  `<select>`; a página agora devolve a opção salva diretamente no elemento.
- **Corrida no `<dialog>`:** o navegador dispara `close` como tarefa enfileirada; se o modal reabria antes, o
  evento antigo fechava o novo. A diretiva ignora `close` quando o diálogo já está aberto de novo.
- **Cache de categorias entre usuários:** ao trocar de usuário, as categorias do anterior continuariam na tela.

## Alternativas consideradas
- **Angular Material:** maduro e acessível, mas com visual Material Design genérico e customização de tema
  trabalhosa. Escolhido o padrão shadcn por ser o visual de referência de produtos SaaS atuais.
- **Spartan UI (port do shadcn para Angular):** ainda em evolução e acopla o projeto a mais uma dependência.
- **Cypress:** semelhante, mas o Playwright roda vários navegadores/dispositivos, é mais rápido em paralelo e tem
  seletores por papel acessível nativos.
