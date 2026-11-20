import { CurrencyPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinanceApi } from '../core/finance-api';
import { BrDatePipe, firstDay, lastDay, suggestPattern } from '../core/format';
import { Paged, Transaction } from '../core/models';
import { ToastService } from '../core/toast.service';

const PAGE_SIZE = 50;
const UNCATEGORIZED = 'none';

/** A category change waiting for "only this one" or "create a rule". */
interface PendingCategorization {
  transaction: Transaction;
  categoryId: number;
  categoryName: string;
  pattern: string;
}

@Component({
  selector: 'app-transactions-page',
  imports: [CurrencyPipe, FormsModule, BrDatePipe],
  template: `
    <div class="page-header">
      <h1>Transações</h1>
      <span class="muted">{{ result.value()?.totalCount ?? 0 }} encontradas</span>
    </div>

    <section class="card filters">
      <label>Buscar
        <input type="search" placeholder="Descrição" [ngModel]="search()" (ngModelChange)="search.set($event); page.set(1)"
               [ngModelOptions]="{ updateOn: 'blur' }" (keyup.enter)="$any($event.target).blur()" />
      </label>
      <label>Conta
        <select [ngModel]="accountId()" (ngModelChange)="accountId.set($event); page.set(1)">
          <option value="">Todas</option>
          @for (a of accounts.value(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
        </select>
      </label>
      <label>Categoria
        <select [ngModel]="category()" (ngModelChange)="category.set($event); page.set(1)">
          <option value="">Todas</option>
          <option [value]="UNCATEGORIZED">Sem categoria</option>
          @for (c of categories.value(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
        </select>
      </label>
      <label>De <input type="month" [ngModel]="from()" (ngModelChange)="from.set($event); page.set(1)" /></label>
      <label>Até <input type="month" [ngModel]="to()" (ngModelChange)="to.set($event); page.set(1)" /></label>
    </section>

    @if (pending(); as p) {
      <section class="card callout">
        <p>
          Mover <strong>{{ p.transaction.description }}</strong> para <strong>{{ p.categoryName }}</strong>.
          Quer criar uma regra para categorizar automaticamente as parecidas (agora e nas próximas importações)?
        </p>
        <div class="row">
          <label class="grow">Descrição contém
            <input [ngModel]="p.pattern" (ngModelChange)="pending.set({ ...p, pattern: $event })" />
          </label>
          <button (click)="confirm(true)" [disabled]="!p.pattern.trim()">Criar regra e aplicar</button>
          <button class="secondary" (click)="confirm(false)">Só esta</button>
          <button class="link" (click)="cancel()">Cancelar</button>
        </div>
      </section>
    }

    <section class="card table-card">
      <table>
        <thead>
          <tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Categoria</th><th class="num">Valor</th></tr>
        </thead>
        <tbody>
          @for (t of result.value()?.items; track t.id) {
            <tr>
              <td class="nowrap">{{ t.date | brDate }}</td>
              <td>{{ t.description }}</td>
              <td class="muted nowrap">{{ t.accountName }}</td>
              <td>
                <select class="compact" [class.unset]="t.categoryId === null"
                        [ngModel]="t.categoryId" (ngModelChange)="changeCategory(t, $event)">
                  <option [ngValue]="null">— sem categoria —</option>
                  @for (c of categories.value(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                </select>
              </td>
              <td class="num nowrap" [class.positive]="t.amount > 0" [class.negative]="t.amount < 0">
                {{ t.amount | currency }}
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="empty muted">{{ result.isLoading() ? 'Carregando…' : 'Nenhuma transação.' }}</td></tr>
          }
        </tbody>
      </table>

      @if (pageCount() > 1) {
        <div class="pager">
          <button class="secondary" [disabled]="page() === 1" (click)="page.set(page() - 1)">Anterior</button>
          <span class="muted">Página {{ page() }} de {{ pageCount() }}</span>
          <button class="secondary" [disabled]="page() === pageCount()" (click)="page.set(page() + 1)">Próxima</button>
        </div>
      }
    </section>
  `,
})
export class TransactionsPage {
  private readonly api = inject(FinanceApi);
  private readonly toast = inject(ToastService);
  protected readonly UNCATEGORIZED = UNCATEGORIZED;

  // Query string (?categoryId=3 or ?uncategorized=true, from the dashboard links) seeds the filter.
  readonly categoryId = input<string>();
  readonly uncategorized = input<string>();

  protected readonly accounts = this.api.accounts();
  protected readonly categories = this.api.categories();

  protected readonly search = signal('');
  protected readonly accountId = signal('');
  protected readonly category = linkedSignal(() => (this.uncategorized() ? UNCATEGORIZED : (this.categoryId() ?? '')));
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly page = signal(1);
  protected readonly pending = signal<PendingCategorization | null>(null);

  // Any filter change re-runs this request.
  protected readonly result = httpResource<Paged<Transaction>>(() => {
    const params: Record<string, string | number | boolean> = { page: this.page(), pageSize: PAGE_SIZE };
    if (this.search()) params['search'] = this.search();
    if (this.accountId()) params['accountId'] = this.accountId();
    if (this.category() === UNCATEGORIZED) params['uncategorized'] = true;
    else if (this.category()) params['categoryId'] = this.category();
    if (this.from()) params['from'] = firstDay(this.from());
    if (this.to()) params['to'] = lastDay(this.to());
    return { url: '/api/transactions', params };
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil((this.result.value()?.totalCount ?? 0) / PAGE_SIZE)));

  protected changeCategory(transaction: Transaction, categoryId: number | null): void {
    if (categoryId === null) {
      this.api.categorize(transaction.id, null).subscribe(() => this.result.reload());
      return;
    }
    const categoryName = this.categories.value().find((c) => c.id === categoryId)?.name ?? '';
    this.pending.set({ transaction, categoryId, categoryName, pattern: suggestPattern(transaction.description) });
  }

  /** Puts the row's <select> back to the saved category. */
  protected cancel(): void {
    this.pending.set(null);
    this.result.reload();
  }

  protected confirm(createRule: boolean): void {
    const p = this.pending();
    if (!p) return;

    this.api.categorize(p.transaction.id, p.categoryId, createRule ? p.pattern.trim() : undefined).subscribe((r) => {
      this.pending.set(null);
      this.toast.success(
        createRule
          ? `Regra "${p.pattern.trim()}" criada. Mais ${r.alsoCategorized} transação(ões) categorizada(s).`
          : 'Categoria atualizada.',
      );
      this.result.reload();
      if (createRule) this.categories.reload();
    });
  }
}
