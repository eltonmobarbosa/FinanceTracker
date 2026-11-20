import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoryStore } from '../core/category-store';
import { FinanceApi } from '../core/finance-api';
import { Category, CategoryRule } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ConfirmService } from '../shared/confirm';
import { Icon } from '../shared/icon';
import { Modal } from '../shared/modal';

@Component({
  selector: 'app-categories-page',
  imports: [FormsModule, Icon, Modal],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Categorias e regras</h1>
        <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
          Uma regra diz: <em>se a descrição contém este texto, a transação vai para esta categoria</em>. Maiúsculas e acentos
          são ignorados. Se duas regras casarem, vence a de maior prioridade e, no empate, o texto mais longo.
        </p>
      </div>
      <button class="btn btn-primary" (click)="openEditor(null)"><app-icon name="plus" /> Nova categoria</button>
    </div>

    <div class="relative mt-6 max-w-sm">
      <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
      <input class="input pl-9" type="search" placeholder="Buscar categoria ou regra…" aria-label="Buscar categoria"
             [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
    </div>

    <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      @for (category of visible(); track category.id) {
        <article class="card flex flex-col" [attr.aria-label]="'Categoria ' + category.name">
          <div class="card-header items-center">
            <div class="flex min-w-0 items-center gap-2.5">
              <span class="size-3 shrink-0 rounded-full" [style.background]="store.colorOf(category.id)"></span>
              <h2 class="card-title truncate">{{ category.name }}</h2>
            </div>
            <div class="flex shrink-0">
              <button class="btn btn-ghost btn-icon size-8 text-muted-foreground" (click)="openEditor(category)"
                      [attr.aria-label]="'Editar ' + category.name"><app-icon name="pencil" [size]="14" /></button>
              <button class="btn btn-ghost btn-icon size-8 text-muted-foreground hover:text-destructive" (click)="remove(category)"
                      [attr.aria-label]="'Excluir ' + category.name"><app-icon name="trash" [size]="14" /></button>
            </div>
          </div>

          <div class="card-content flex flex-1 flex-col">
            <p class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {{ category.rules.length }} regra(s)
              @if (category.isTransfer) {
                <span class="badge" title="Não entra nos totais de entradas e gastos">
                  <app-icon name="arrow-left-right" [size]="12" /> Transferência · fora dos totais
                </span>
              }
            </p>
            <ul class="mt-2 flex flex-wrap gap-1.5">
              @for (rule of category.rules; track rule.id) {
                <li class="badge bg-muted/60 py-1 pr-1 pl-2.5">
                  {{ rule.pattern }}
                  @if (rule.priority > 0) { <span class="text-muted-foreground" title="Prioridade">↑{{ rule.priority }}</span> }
                  <button class="grid size-4 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-border hover:text-foreground"
                          (click)="removeRule(rule)" [attr.aria-label]="'Remover regra ' + rule.pattern">
                    <app-icon name="x" [size]="10" />
                  </button>
                </li>
              } @empty {
                <li class="text-sm text-muted-foreground">Nenhuma regra. Só categorização manual.</li>
              }
            </ul>

            <form class="mt-auto flex gap-2 pt-4" (ngSubmit)="addRule(category, ruleInput)">
              <input #ruleInput class="input h-8 text-xs" placeholder="Nova regra: descrição contém…" maxlength="100"
                     [attr.aria-label]="'Nova regra para ' + category.name" />
              <button type="submit" class="btn btn-outline btn-sm" [attr.aria-label]="'Adicionar regra em ' + category.name">
                <app-icon name="plus" [size]="14" />
              </button>
            </form>
          </div>
        </article>
      } @empty {
        @if (store.categories.isLoading()) {
          @for (i of [1, 2, 3]; track i) { <div class="skeleton h-48"></div> }
        } @else {
          <p class="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
        }
      }
    </div>

    <dialog class="modal" [(appModal)]="editorOpen" aria-labelledby="category-title">
      <form class="p-6" (ngSubmit)="save()">
        <h2 id="category-title" class="text-lg font-semibold">{{ editing() ? 'Editar categoria' : 'Nova categoria' }}</h2>

        <div class="mt-5 space-y-2">
          <label class="label" for="category-name">Nome</label>
          <input id="category-name" name="name" class="input" [(ngModel)]="name" maxlength="50" placeholder="Ex.: Pets" autocomplete="off" />
        </div>

        <label class="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <input type="checkbox" name="isTransfer" class="mt-0.5 size-4" [(ngModel)]="isTransfer" />
          <span>
            <span class="block text-sm font-medium">Transferência entre minhas contas</span>
            <span class="text-sm text-muted-foreground">Ex.: pagamento da fatura do cartão. Fica fora dos totais para não contar o mesmo dinheiro duas vezes.</span>
          </span>
        </label>

        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="btn btn-outline" (click)="editorOpen.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="!name.trim()">{{ editing() ? 'Salvar' : 'Criar categoria' }}</button>
        </div>
      </form>
    </dialog>
  `,
})
export class CategoriesPage {
  private readonly api = inject(FinanceApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly store = inject(CategoryStore);

  protected readonly filter = signal('');
  protected readonly visible = computed(() => {
    const term = normalize(this.filter().trim());
    const all = this.store.categories.value();
    return term ? all.filter((c) => normalize(c.name).includes(term) || c.rules.some((r) => normalize(r.pattern).includes(term))) : all;
  });

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<Category | null>(null);
  protected name = '';
  protected isTransfer = false;

  protected openEditor(category: Category | null): void {
    this.editing.set(category);
    this.name = category?.name ?? '';
    this.isTransfer = category?.isTransfer ?? false;
    this.editorOpen.set(true);
  }

  protected save(): void {
    const name = this.name.trim();
    const current = this.editing();
    const request = current
      ? this.api.updateCategory(current.id, name, this.isTransfer)
      : this.api.createCategory(name, this.isTransfer);

    request.subscribe(() => {
      this.editorOpen.set(false);
      this.toast.success(current ? 'Categoria atualizada' : 'Categoria criada', current ? undefined : 'Adicione regras para ela se preencher sozinha.');
      this.store.reload();
    });
  }

  protected async remove(category: Category): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Excluir "${category.name}"?`,
      message: `As ${category.rules.length} regra(s) serão apagadas e as transações dessa categoria ficarão sem categoria.`,
      confirmText: 'Excluir categoria',
      destructive: true,
    });
    if (!ok) return;
    this.api.deleteCategory(category.id).subscribe(() => {
      this.toast.success('Categoria excluída');
      this.store.reload();
    });
  }

  protected addRule(category: Category, input: HTMLInputElement): void {
    const pattern = input.value.trim();
    if (!pattern) return;
    this.api.addRule(category.id, pattern).subscribe(() => {
      input.value = '';
      this.toast.success('Regra adicionada', `"${pattern}" → ${category.name}. Vale para as próximas importações.`);
      this.store.reload();
    });
  }

  protected removeRule(rule: CategoryRule): void {
    this.api.deleteRule(rule.id).subscribe(() => {
      this.toast.success('Regra removida');
      this.store.reload();
    });
  }
}

/** Accent/case-insensitive comparison, same idea as the server's rule matching. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
