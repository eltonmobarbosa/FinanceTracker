import { CurrencyPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoryStore } from '../core/category-store';
import { FinanceApi } from '../core/finance-api';
import { suggestPattern } from '../core/format';
import { Paged, Transaction } from '../core/models';
import { ToastService } from '../core/toast.service';
import { Icon } from '../shared/icon';
import { Modal } from '../shared/modal';

/** The category change being confirmed. */
export interface CategorizeTarget {
  transaction: Transaction;
  categoryId: number;
}

interface Draft extends CategorizeTarget {
  createRule: boolean;
  pattern: string;
}

/** Confirms a category change and, only if the user asks, turns it into a rule. */
@Component({
  selector: 'app-categorize-dialog',
  imports: [CurrencyPipe, FormsModule, Icon, Modal],
  template: `
    <dialog class="modal max-w-lg" [appModal]="draft() !== null" (appModalChange)="!$event && cancel()" aria-labelledby="categorize-title">
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
export class CategorizeDialog {
  private readonly api = inject(FinanceApi);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(CategoryStore);

  readonly target = input<CategorizeTarget | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  // Unchecked by default: fixing one line must not silently change how future imports are categorized.
  protected readonly draft = linkedSignal<Draft | null>(() => {
    const target = this.target();
    return target ? { ...target, createRule: false, pattern: suggestPattern(target.transaction.description) } : null;
  });
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

  protected patch(changes: Partial<Draft>): void {
    this.draft.update((d) => (d ? { ...d, ...changes } : d));
  }

  protected cancel(): void {
    if (this.draft()) this.cancelled.emit();
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
        this.saved.emit();
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
