import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FinanceApi } from '../core/finance-api';
import { Account, AccountType, ImportResult } from '../core/models';

@Component({
  selector: 'app-import-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <h1>Contas e importação</h1>
    </div>

    <section class="card">
      <h2>Nova conta</h2>
      <form class="row" (ngSubmit)="createAccount()">
        <label class="grow">Nome
          <input name="name" [(ngModel)]="newName" placeholder="Ex.: Nubank cartão" maxlength="100" required />
        </label>
        <label>Tipo
          <select name="type" [(ngModel)]="newType">
            <option value="CreditCard">Cartão de crédito</option>
            <option value="Checking">Conta corrente</option>
          </select>
        </label>
        <button type="submit" [disabled]="!newName.trim()">Adicionar</button>
      </form>
    </section>

    <section class="accounts">
      @for (account of accounts.value(); track account.id) {
        <div class="card">
          <div class="row spread">
            <div>
              <h2>{{ account.name }}</h2>
              <span class="badge">{{ account.type === 'CreditCard' ? 'Cartão de crédito' : 'Conta corrente' }}</span>
            </div>
            <button class="link danger" (click)="deleteAccount(account)">Excluir</button>
          </div>

          <label class="dropzone" [class.busy]="busyAccountId() === account.id">
            <input type="file" accept=".ofx,.csv" (change)="upload(account, $event)" hidden />
            @if (busyAccountId() === account.id) {
              Importando…
            } @else {
              <strong>Escolher extrato</strong>
              <span class="muted small">OFX de qualquer banco ou CSV da fatura Nubank · até 5 MB</span>
            }
          </label>

          @if (results()[account.id]; as r) {
            <p class="result">
              {{ r.total }} lidas · <strong>{{ r.imported }} novas</strong> · {{ r.duplicates }} já importadas ·
              {{ r.categorized }} categorizadas automaticamente.
              <a routerLink="/transacoes" [queryParams]="r.imported - r.categorized > 0 ? { uncategorized: true } : {}">
                {{ r.imported - r.categorized > 0 ? 'Categorizar as restantes' : 'Ver transações' }} →
              </a>
            </p>
          }
        </div>
      } @empty {
        @if (!accounts.isLoading()) {
          <div class="card empty muted">Crie uma conta acima para importar o primeiro extrato.</div>
        }
      }
    </section>
  `,
})
export class ImportPage {
  private readonly api = inject(FinanceApi);

  protected readonly accounts = this.api.accounts();
  protected readonly busyAccountId = signal<number | null>(null);
  protected readonly results = signal<Record<number, ImportResult>>({});

  protected newName = '';
  protected newType: AccountType = 'CreditCard';

  protected createAccount(): void {
    this.api.createAccount(this.newName.trim(), this.newType).subscribe(() => {
      this.newName = '';
      this.accounts.reload();
    });
  }

  protected deleteAccount(account: Account): void {
    if (!confirm(`Excluir "${account.name}" e todas as suas transações?`)) return;
    this.api.deleteAccount(account.id).subscribe(() => this.accounts.reload());
  }

  protected upload(account: Account, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allows choosing the same file again (to see the duplicate detection)
    if (!file) return;

    this.busyAccountId.set(account.id);
    this.api.importStatement(account.id, file).subscribe({
      next: (result) => {
        this.results.update((all) => ({ ...all, [account.id]: result }));
        this.busyAccountId.set(null);
      },
      error: () => this.busyAccountId.set(null),
    });
  }
}
