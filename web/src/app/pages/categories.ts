import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinanceApi } from '../core/finance-api';
import { Category, CategoryRule } from '../core/models';

@Component({
  selector: 'app-categories-page',
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <h1>Categorias e regras</h1>
    </div>
    <p class="muted">
      Uma regra diz: <em>se a descrição contém o texto, a transação vai para esta categoria</em> (ignora maiúsculas e
      acentos). Se várias regras casarem, vence a de maior prioridade e, no empate, o texto mais longo.
    </p>

    <section class="card">
      <h2>Nova categoria</h2>
      <form class="row" (ngSubmit)="create()">
        <label class="grow">Nome <input name="name" [(ngModel)]="newName" maxlength="50" required /></label>
        <label class="check"><input type="checkbox" name="transfer" [(ngModel)]="newIsTransfer" /> Transferência</label>
        <button type="submit" [disabled]="!newName.trim()">Adicionar</button>
      </form>
    </section>

    <section class="category-grid">
      @for (category of categories.value(); track category.id) {
        <div class="card">
          <div class="row spread">
            <h2>{{ category.name }}</h2>
            <button class="link danger" (click)="remove(category)">Excluir</button>
          </div>
          <label class="check small">
            <input type="checkbox" [ngModel]="category.isTransfer" (ngModelChange)="toggleTransfer(category, $event)" />
            Transferência entre contas (fora dos relatórios)
          </label>

          <div class="chips">
            @for (rule of category.rules; track rule.id) {
              <span class="chip" [title]="'Prioridade ' + rule.priority">
                {{ rule.pattern }}@if (rule.priority > 0) { <small>· {{ rule.priority }}</small> }
                <button class="link" (click)="removeRule(rule)" [attr.aria-label]="'Remover regra ' + rule.pattern">×</button>
              </span>
            } @empty {
              <span class="muted small">Sem regras.</span>
            }
          </div>

          <form class="row" (ngSubmit)="addRule(category, ruleInput)">
            <input #ruleInput placeholder="Descrição contém…" maxlength="100" class="grow" />
            <button type="submit" class="secondary">+ Regra</button>
          </form>
        </div>
      }
    </section>
  `,
})
export class CategoriesPage {
  private readonly api = inject(FinanceApi);

  protected readonly categories = this.api.categories();
  protected newName = '';
  protected newIsTransfer = false;

  protected create(): void {
    this.api.createCategory(this.newName.trim(), this.newIsTransfer).subscribe(() => {
      this.newName = '';
      this.newIsTransfer = false;
      this.categories.reload();
    });
  }

  protected toggleTransfer(category: Category, isTransfer: boolean): void {
    this.api.updateCategory(category.id, category.name, isTransfer).subscribe(() => this.categories.reload());
  }

  protected remove(category: Category): void {
    if (!confirm(`Excluir "${category.name}"? As transações dela ficam sem categoria.`)) return;
    this.api.deleteCategory(category.id).subscribe(() => this.categories.reload());
  }

  protected addRule(category: Category, input: HTMLInputElement): void {
    const pattern = input.value.trim();
    if (!pattern) return;
    this.api.addRule(category.id, pattern).subscribe(() => {
      input.value = '';
      this.categories.reload();
    });
  }

  protected removeRule(rule: CategoryRule): void {
    this.api.deleteRule(rule.id).subscribe(() => this.categories.reload());
  }
}
