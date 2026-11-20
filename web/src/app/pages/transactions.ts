import { CurrencyPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoryStore } from '../core/category-store';
import { FinanceApi } from '../core/finance-api';
import { BrDatePipe, PERIOD_LABELS, PeriodPreset, periodRange, suggestPattern } from '../core/format';
import { Paged, Transaction } from '../core/models';
import { ToastService } from '../core/toast.service';
import { Icon } from '../shared/icon';
import { Modal } from '../shared/modal';

const PAGE_SIZE = 25;

/** The category change being confirmed in the dialog. */
interface Draft {
  transaction: Transaction;
  /** The row's select, to put back the saved option if the user cancels. */
  select: HTMLSelectElement;
  categoryId: number;
  createRule: boolean;
  pattern: string;
}

@Component({
  selector: 'app-transactions-page',
  imports: [CurrencyPipe, FormsModule, BrDatePipe, Icon, Modal],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Transações</h1>
        <p class="mt-1 text-sm text-muted-foreground">Mude a categoria de qualquer linha. Crie uma regra e as parecidas se ajustam sozinhas.</p>
      </div>
      <div class="segmented" role="group" aria-label="Mostrar">
        <button [attr.aria-pressed]="!onlyUncategorized()" (click)="setCategory('')">Todas</button>
        <button [attr.aria-pressed]="onlyUncategorized()" (click)="setCategory('none')">
          Sem categoria
          @if (uncategorizedCount()) {
            <span class="ml-1 rounded-full bg-warning-soft px-1.5 text-xs text-warning">{{ uncategorizedCount() }}</span>
          }
        </button>
      </div>
    </div>

    <div class="mt-6 flex flex-wrap gap-2">
      <div class="relative min-w-56 flex-1">
        <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
        <input class="input pl-9" type="search" placeholder="Buscar pela descrição…" aria-label="Buscar"
               [ngModel]="searchInput()" (ngModelChange)="searchInput.set($event)" />
      </div>
      <select class="input w-auto" aria-label="Conta" [ngModel]="accountId()" (ngModelChange)="accountId.set($event); page.set(1)">
        <option value="">Todas as contas</option>
        @for (a of accounts.value(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
      </select>
      <select class="input w-auto" aria-label="Categoria" [ngModel]="category()" (ngModelChange)="setCategory($event)">
        <option value="">Todas as categorias</option>
        <option value="none">Sem categoria</option>
        @for (c of store.categories.value(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
      </select>
      <select class="input w-auto" aria-label="Período" [ngModel]="period()" (ngModelChange)="period.set($event); page.set(1)">
        @for (p of presets; track p) { <option [value]="p">{{ labels[p] }}</option> }
      </select>
      @if (hasFilters()) {
        <button class="btn btn-ghost" (click)="clearFilters()"><app-icon name="x" /> Limpar filtros</button>
      }
    </div>

    <div class="card mt-4 overflow-hidden">
      <!-- One markup, two layouts: a table from md up; below that each row becomes a 2x2 block (bank-app style):
           description | amount / category | date. -->
      <div class="md:overflow-x-auto">
        <table class="w-full text-sm max-md:block">
          <thead class="border-b bg-muted/50 text-left text-xs text-muted-foreground max-md:hidden">
            <tr>
              <th class="px-4 py-3 font-medium">Descrição</th>
              <th class="px-4 py-3 font-medium">Categoria</th>
              <th class="px-4 py-3 font-medium">Data</th>
              <th class="px-4 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody class="divide-y max-md:block">
            @for (t of result.value()?.items; track t.id) {
              <tr class="transition-colors hover:bg-muted/40 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-2 max-md:px-4 max-md:py-3">
                <td class="px-4 py-3 md:w-1/2 md:max-w-0 max-md:min-w-0 max-md:p-0">
                  <p class="truncate font-medium" [title]="t.description">{{ t.description }}</p>
                  <p class="flex items-center gap-1 text-xs text-muted-foreground">
                    <app-icon name="wallet" [size]="12" /> {{ t.accountName }}
                  </p>
                </td>
                <td class="px-4 py-3 max-md:col-start-1 max-md:row-start-2 max-md:p-0">
                  <label class="relative inline-flex items-center">
                    <span class="pointer-events-none absolute left-2.5 size-2 rounded-full" [style.background]="store.colorOf(t.categoryId)"></span>
                    <select #categorySelect class="h-7 cursor-pointer appearance-none rounded-full border bg-card py-0 pr-3 pl-6 text-xs font-medium hover:bg-muted"
                            [class.border-dashed]="t.categoryId === null" [class.text-muted-foreground]="t.categoryId === null"
                            [attr.aria-label]="'Categoria de ' + t.description"
                            [ngModel]="t.categoryId" (ngModelChange)="startCategorize(t, $event, categorySelect)">
                      <option [ngValue]="null">Sem categoria</option>
                      @for (c of store.categories.value(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                    </select>
                  </label>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-muted-foreground max-md:col-start-2 max-md:row-start-2 max-md:self-center max-md:p-0 max-md:text-right max-md:text-xs">
                  {{ t.date | brDate }}
                </td>
                <td class="tabular px-4 py-3 text-right font-medium whitespace-nowrap max-md:col-start-2 max-md:row-start-1 max-md:p-0" [class.text-positive]="t.amount > 0">
                  {{ t.amount > 0 ? '+' : '' }}{{ t.amount | currency }}
                </td>
              </tr>
            } @empty {
              <tr class="max-md:block">
                <td colspan="4" class="px-4 py-16 text-center max-md:block">
                  @if (result.isLoading()) {
                    <app-icon name="loader" class="animate-spin text-muted-foreground" [size]="20" />
                  } @else {
                    <span class="mx-auto grid size-10 place-items-center rounded-full bg-muted"><app-icon name="inbox" /></span>
                    <p class="mt-3 font-medium">Nenhuma transação encontrada</p>
                    <p class="text-sm text-muted-foreground">{{ hasFilters() ? 'Tente ajustar ou limpar os filtros.' : 'Importe um extrato em Contas e importação.' }}</p>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (total() > 0) {
        <div class="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>Mostrando <strong class="text-foreground">{{ rangeStart() }}–{{ rangeEnd() }}</strong> de {{ total() }}</span>
          <div class="flex gap-2">
            <button class="btn btn-outline btn-sm" [disabled]="page() === 1" (click)="page.set(page() - 1)" aria-label="Página anterior">
              <app-icon name="chevron-left" [size]="14" /> Anterior
            </button>
            <button class="btn btn-outline btn-sm" [disabled]="rangeEnd() >= total()" (click)="page.set(page() + 1)" aria-label="Próxima página">
              Próxima <app-icon name="chevron-right" [size]="14" />
            </button>
          </div>
        </div>
      }
    </div>

    <dialog class="modal max-w-lg" [(appModal)]="dialogOpen" (appModalChange)="!$event && cancel()" aria-labelledby="categorize-title">
      @if (draft(); as d) {
        <form class="p-6" (ngSubmit)="save()">
          <h2 id="categorize-title" class="text-lg font-semibold">Categorizar transação</h2>
          <p class="mt-1 truncate text-sm text-muted-foreground">{{ d.transaction.description }} · {{ d.transaction.amount | currency }}</p>

          <div class="mt-5 space-y-2">
            <label class="label" for="dlg-category">Categoria</label>
            <select id="dlg-category" name="category" class="input" [ngModel]="d.categoryId" (ngModelChange)="patch({ categoryId: $event })">
              @for (c of store.categories.value(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
            </select>
          </div>

          <div class="mt-5 rounded-lg border p-4" [class]="d.createRule ? 'bg-muted/40' : ''">
            <label class="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="createRule" class="mt-0.5 size-4 accent-current" [ngModel]="d.createRule" (ngModelChange)="patch({ createRule: $event })" />
              <span>
                <span class="flex items-center gap-1.5 text-sm font-medium"><app-icon name="sparkles" [size]="14" /> Criar regra automática</span>
                <span class="text-sm text-muted-foreground">Aplica agora às transações sem categoria e às próximas importações.</span>
              </span>
            </label>
            @if (d.createRule) {
              <div class="mt-4 space-y-2 pl-7">
                <label class="label" for="dlg-pattern">Quando a descrição contiver</label>
                <input id="dlg-pattern" name="pattern" class="input" maxlength="100" [ngModel]="d.pattern" (ngModelChange)="patch({ pattern: $event })" />
                <p class="text-xs text-muted-foreground">
                  @if (d.pattern.trim().length < 2) { Digite pelo menos 2 caracteres. }
                  @else { Cerca de <strong class="text-foreground">{{ preview() }}</strong> outra(s) transação(ões) sem categoria contêm esse texto. }
                </p>
              </div>
            }
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="btn btn-outline" (click)="cancel()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving() || (d.createRule && d.pattern.trim().length < 2)">
              @if (saving()) { <app-icon name="loader" class="animate-spin" /> }
              {{ d.createRule ? 'Salvar e criar regra' : 'Salvar' }}
            </button>
          </div>
        </form>
      }
    </dialog>
  `,
})
export class TransactionsPage {
  private readonly api = inject(FinanceApi);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(CategoryStore);

  // Query string (?categoryId=3 or ?uncategorized=true, from dashboard links) seeds the category filter.
  readonly categoryId = input<string>();
  readonly uncategorized = input<string>();

  protected readonly presets: PeriodPreset[] = ['all', 'month', 'last-month', '3m', '6m', '12m'];
  protected readonly labels = PERIOD_LABELS;
  protected readonly accounts = this.api.accounts();

  protected readonly searchInput = signal('');
  private readonly search = signal('');
  protected readonly accountId = signal('');
  protected readonly category = linkedSignal(() => (this.uncategorized() ? 'none' : (this.categoryId() ?? '')));
  protected readonly period = signal<PeriodPreset>('all');
  protected readonly page = signal(1);

  protected readonly onlyUncategorized = computed(() => this.category() === 'none');
  protected readonly hasFilters = computed(() =>
    !!(this.search() || this.accountId() || this.category() || this.period() !== 'all'));

  protected readonly result = httpResource<Paged<Transaction>>(() => {
    const params: Record<string, string | number | boolean> = { page: this.page(), pageSize: PAGE_SIZE, ...periodRange(this.period()) };
    if (this.search()) params['search'] = this.search();
    if (this.accountId()) params['accountId'] = this.accountId();
    if (this.category() === 'none') params['uncategorized'] = true;
    else if (this.category()) params['categoryId'] = this.category();
    return { url: '/api/transactions', params };
  });

  private readonly uncategorizedPage = httpResource<Paged<Transaction>>(() => {
    this.result.value(); // refresh the badge whenever the list reloads
    return { url: '/api/transactions', params: { uncategorized: true, pageSize: 1 } };
  });
  protected readonly uncategorizedCount = computed(() => this.uncategorizedPage.value()?.totalCount ?? 0);

  protected readonly total = computed(() => this.result.value()?.totalCount ?? 0);
  protected readonly rangeStart = computed(() => (this.page() - 1) * PAGE_SIZE + 1);
  protected readonly rangeEnd = computed(() => Math.min(this.page() * PAGE_SIZE, this.total()));

  // ---- Categorize dialog ----
  protected readonly dialogOpen = signal(false);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly saving = signal(false);

  // Live preview of how many uncategorized transactions the rule would also hit (server LIKE search: approximate).
  private readonly previewPage = httpResource<Paged<Transaction>>(() => {
    const d = this.draft();
    const pattern = d?.createRule ? d.pattern.trim() : '';
    return pattern.length >= 2 ? { url: '/api/transactions', params: { uncategorized: true, search: pattern, pageSize: 1 } } : undefined;
  });
  protected readonly preview = computed(() => {
    const d = this.draft();
    const count = this.previewPage.value()?.totalCount ?? 0;
    return d?.transaction.categoryId === null ? Math.max(0, count - 1) : count;
  });

  constructor() {
    // Debounce: search 300 ms after the user stops typing, not on every key.
    effect((onCleanup) => {
      const value = this.searchInput().trim();
      const timer = setTimeout(() => {
        this.search.set(value);
        this.page.set(1);
      }, 300);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected setCategory(value: string): void {
    this.category.set(value);
    this.page.set(1);
  }

  protected clearFilters(): void {
    this.searchInput.set('');
    this.search.set('');
    this.accountId.set('');
    this.category.set('');
    this.period.set('all');
    this.page.set(1);
  }

  protected startCategorize(transaction: Transaction, categoryId: number | null, select: HTMLSelectElement): void {
    if (categoryId === null) {
      this.api.categorize(transaction.id, null).subscribe(() => {
        this.toast.success('Categoria removida');
        this.result.reload();
      });
      return;
    }
    this.draft.set({ transaction, select, categoryId, createRule: true, pattern: suggestPattern(transaction.description) });
    this.dialogOpen.set(true);
  }

  protected patch(changes: Partial<Draft>): void {
    this.draft.update((d) => (d ? { ...d, ...changes } : d));
  }

  /**
   * Closing without saving (Cancel button, Esc or backdrop): the row's select goes back to the saved category.
   * Done on the element because the model never changed, so Angular has nothing to re-render.
   * Options are [Sem categoria, ...categories], hence the +1.
   */
  protected cancel(): void {
    this.dialogOpen.set(false);
    const d = this.draft();
    if (!d) return;
    const saved = d.transaction.categoryId;
    d.select.selectedIndex = saved === null ? 0 : this.store.categories.value().findIndex((c) => c.id === saved) + 1;
    this.draft.set(null);
  }

  protected save(): void {
    const d = this.draft();
    if (!d) return;
    const pattern = d.createRule ? d.pattern.trim() : undefined;
    const categoryName = this.store.categories.value().find((c) => c.id === d.categoryId)?.name;

    this.saving.set(true);
    this.api.categorize(d.transaction.id, d.categoryId, pattern).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.draft.set(null);
        this.dialogOpen.set(false);
        this.result.reload();
        if (pattern) {
          this.store.reload();
          this.toast.success(`Regra criada em ${categoryName}`,
            r.alsoCategorized ? `Mais ${r.alsoCategorized} transação(ões) foram categorizadas.` : 'Ela vale para as próximas importações.');
        } else {
          this.toast.success(`Movida para ${categoryName}`);
        }
      },
      error: () => this.saving.set(false),
    });
  }
}
