import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { CategoryStore } from '../core/category-store';
import { FinanceApi } from '../core/finance-api';
import { BrDatePipe } from '../core/format';
import { Account, AccountType, ImportResult } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ConfirmService } from '../shared/confirm';
import { Icon } from '../shared/icon';
import { Modal } from '../shared/modal';

const ACCEPTED = ['.ofx', '.csv'];

/** Totals of the files sent in one go, and what is needed to undo them. */
interface UploadSummary {
  total: number;
  imported: number;
  duplicates: number;
  categorized: number;
  importIds: string[];
}

@Component({
  selector: 'app-accounts-page',
  imports: [FormsModule, RouterLink, Icon, Modal, BrDatePipe],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Contas e importação</h1>
        <p class="mt-1 text-sm text-muted-foreground">Envie o extrato de cada conta. Reenviar o mesmo arquivo não duplica nada.</p>
      </div>
      <button class="btn btn-primary" (click)="openNewAccount()"><app-icon name="plus" /> Nova conta</button>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <div class="grid content-start gap-4 lg:col-span-2">
        @for (account of accounts.value(); track account.id) {
          <article class="card" [attr.aria-label]="account.name">
            <div class="card-header items-center">
              <div class="flex items-center gap-3">
                <span class="grid size-10 place-items-center rounded-lg bg-muted">
                  <app-icon [name]="account.type === 'CreditCard' ? 'credit-card' : 'landmark'" [size]="18" />
                </span>
                <div>
                  <h2 class="card-title">{{ account.name }}</h2>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ account.type === 'CreditCard' ? 'Cartão de crédito' : 'Conta corrente' }} ·
                    @if (account.lastTransactionDate) {
                      {{ account.transactionCount }} transações · até {{ account.lastTransactionDate | brDate }}
                    } @else {
                      nenhum extrato importado
                    }
                  </p>
                </div>
              </div>
              <button class="btn btn-ghost btn-icon text-muted-foreground hover:text-destructive" (click)="deleteAccount(account)"
                      [attr.aria-label]="'Excluir conta ' + account.name">
                <app-icon name="trash" />
              </button>
            </div>

            <div class="card-content">
              <label class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors hover:border-ring hover:bg-muted/50"
                     [class.border-ring]="dragOver() === account.id" [class.bg-muted]="dragOver() === account.id"
                     (dragover)="$event.preventDefault(); dragOver.set(account.id)" (dragleave)="dragOver.set(null)"
                     (drop)="onDrop(account, $event)">
                <input type="file" multiple class="sr-only" [accept]="accepted" (change)="onPick(account, $event)"
                       [attr.aria-label]="'Arquivo de extrato para ' + account.name" />
                @if (busy() === account.id) {
                  <app-icon name="loader" class="animate-spin text-muted-foreground" [size]="22" />
                  <span class="text-sm font-medium">Importando e categorizando…</span>
                } @else {
                  <span class="grid size-10 place-items-center rounded-full bg-muted"><app-icon name="file-up" [size]="18" /></span>
                  <span class="text-sm"><strong>Clique para escolher</strong> ou arraste o arquivo aqui</span>
                  <span class="text-xs text-muted-foreground">OFX de qualquer banco · CSV da fatura Nubank · até 5 MB</span>
                }
              </label>

              @if (results()[account.id]; as r) {
                <div class="mt-4 rounded-lg border bg-muted/40 p-4" role="status">
                  <p class="flex items-center gap-2 text-sm font-medium">
                    <app-icon name="check" class="text-positive" /> Importação concluída
                  </p>
                  <dl class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><dt class="text-xs text-muted-foreground">Lidas</dt><dd class="tabular text-lg font-semibold">{{ r.total }}</dd></div>
                    <div><dt class="text-xs text-muted-foreground">Novas</dt><dd class="tabular text-lg font-semibold">{{ r.imported }}</dd></div>
                    <div><dt class="text-xs text-muted-foreground">Já existiam</dt><dd class="tabular text-lg font-semibold">{{ r.duplicates }}</dd></div>
                    <div><dt class="text-xs text-muted-foreground">Categorizadas</dt><dd class="tabular text-lg font-semibold">{{ r.categorized }}</dd></div>
                  </dl>
                  <div class="mt-4 flex flex-wrap gap-2">
                    @if (r.imported - r.categorized > 0) {
                      <a routerLink="/transacoes" [queryParams]="{ uncategorized: true }" class="btn btn-outline btn-sm">
                        <app-icon name="sparkles" [size]="14" /> Categorizar {{ r.imported - r.categorized }} restante(s)
                      </a>
                    } @else if (r.imported > 0) {
                      <a routerLink="/" class="btn btn-outline btn-sm">Ver visão geral <app-icon name="chevron-right" [size]="14" /></a>
                    }
                    @if (r.importIds.length) {
                      <button class="btn btn-ghost btn-sm" (click)="undoImport(account)">Desfazer importação</button>
                    }
                  </div>
                </div>
              }
            </div>
          </article>
        } @empty {
          @if (!accounts.isLoading()) {
            <div class="card flex flex-col items-center px-6 py-14 text-center">
              <span class="grid size-12 place-items-center rounded-full bg-muted"><app-icon name="wallet" [size]="22" /></span>
              <h2 class="mt-4 font-semibold">Nenhuma conta ainda</h2>
              <p class="mt-1 max-w-xs text-sm text-muted-foreground">Crie uma conta para cada cartão ou conta bancária que você quer acompanhar.</p>
              <button class="btn btn-primary mt-5" (click)="openNewAccount()"><app-icon name="plus" /> Criar primeira conta</button>
            </div>
          } @else {
            <div class="skeleton h-64"></div>
          }
        }
      </div>

      <div class="grid h-fit gap-4">
      <aside class="card p-5 text-sm">
        <h2 class="font-semibold">Como exportar o extrato</h2>
        <ol class="mt-4 space-y-4">
          <li>
            <p class="font-medium">Nubank, fatura do cartão (CSV)</p>
            <p class="mt-0.5 text-muted-foreground">No app, abra a fatura do cartão e use a opção de exportar. O CSV chega no seu e-mail.</p>
          </li>
          <li>
            <p class="font-medium">Outros bancos (OFX)</p>
            <p class="mt-0.5 text-muted-foreground">No internet banking pelo computador: Extrato → escolha o período → salvar ou exportar como OFX (às vezes aparece como "Money").</p>
          </li>
          <li>
            <p class="font-medium">Seus dados</p>
            <p class="mt-0.5 text-muted-foreground">O arquivo é lido e descartado. Só as transações ficam salvas, e só você as vê.</p>
          </li>
        </ol>
      </aside>

      <section class="card p-5 text-sm">
        <h2 class="font-semibold">Meus dados</h2>
        <p class="mt-1 text-muted-foreground">Apaga seu usuário, contas, transações, categorias e regras.</p>
        <button class="btn btn-outline btn-sm mt-4 text-destructive" (click)="openDeleteProfile()">Excluir meu perfil</button>
      </section>
      </div>
    </div>

    <dialog class="modal" [(appModal)]="deleteProfileOpen" aria-labelledby="delete-profile-title">
      <form class="p-6" (ngSubmit)="deleteProfile()">
        <h2 id="delete-profile-title" class="text-lg font-semibold">Excluir meu perfil?</h2>
        <p class="mt-1 text-sm text-muted-foreground">Todos os seus dados serão apagados. Isso não pode ser desfeito.</p>

        <div class="mt-5 space-y-2">
          <label class="label" for="delete-password">Confirme sua senha</label>
          <input id="delete-password" name="password" type="password" class="input" autocomplete="current-password" [(ngModel)]="deletePassword" />
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="btn btn-outline" (click)="deleteProfileOpen.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-destructive" [disabled]="!deletePassword">Excluir definitivamente</button>
        </div>
      </form>
    </dialog>

    <dialog class="modal" [(appModal)]="newAccountOpen" aria-labelledby="new-account-title">
      <form class="p-6" (ngSubmit)="createAccount()">
        <h2 id="new-account-title" class="text-lg font-semibold">Nova conta</h2>
        <p class="mt-1 text-sm text-muted-foreground">Um cartão ou uma conta bancária.</p>

        <div class="mt-5 space-y-2">
          <label class="label" for="account-name">Nome</label>
          <input id="account-name" name="name" class="input" [(ngModel)]="newName" maxlength="100" placeholder="Ex.: Nubank cartão" autocomplete="off" />
        </div>

        <fieldset class="mt-5">
          <legend class="label">Tipo</legend>
          <div class="mt-2 grid grid-cols-2 gap-2">
            @for (option of types; track option.value) {
              <label class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors has-checked:border-ring has-checked:bg-muted/60">
                <input type="radio" name="type" class="sr-only" [value]="option.value" [(ngModel)]="newType" />
                <app-icon [name]="option.icon" />
                {{ option.label }}
              </label>
            }
          </div>
        </fieldset>

        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="btn btn-outline" (click)="newAccountOpen.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="!newName.trim()">Criar conta</button>
        </div>
      </form>
    </dialog>
  `,
})
export class AccountsPage {
  private readonly api = inject(FinanceApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly store = inject(CategoryStore);
  private readonly auth = inject(AuthService);

  protected readonly accepted = ACCEPTED.join(',');
  protected readonly types = [
    { value: 'CreditCard' as AccountType, label: 'Cartão de crédito', icon: 'credit-card' as const },
    { value: 'Checking' as AccountType, label: 'Conta corrente', icon: 'landmark' as const },
  ];

  protected readonly accounts = this.api.accounts();
  protected readonly busy = signal<number | null>(null);
  protected readonly dragOver = signal<number | null>(null);
  protected readonly results = signal<Record<number, UploadSummary>>({});

  protected readonly newAccountOpen = signal(false);
  protected newName = '';
  protected newType: AccountType = 'CreditCard';

  protected readonly deleteProfileOpen = signal(false);
  protected deletePassword = '';

  protected openDeleteProfile(): void {
    this.deletePassword = '';
    this.deleteProfileOpen.set(true);
  }

  protected deleteProfile(): void {
    if (!this.deletePassword) return;
    this.api.deleteProfile(this.deletePassword).subscribe(() => {
      this.deleteProfileOpen.set(false);
      this.toast.success('Perfil excluído', 'Seus dados foram apagados.');
      this.auth.logout();
    });
  }

  protected openNewAccount(): void {
    this.newName = '';
    this.newType = 'CreditCard';
    this.newAccountOpen.set(true);
  }

  protected createAccount(): void {
    const name = this.newName.trim();
    if (!name) return;
    this.api.createAccount(name, this.newType).subscribe(() => {
      this.newAccountOpen.set(false);
      this.toast.success('Conta criada', `Agora envie o extrato de "${name}".`);
      this.accounts.reload();
    });
  }

  protected async deleteAccount(account: Account): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Excluir "${account.name}"?`,
      message: 'A conta e todas as transações importadas nela serão apagadas. Isso não pode ser desfeito.',
      confirmText: 'Excluir conta',
      destructive: true,
    });
    if (!ok) return;
    this.api.deleteAccount(account.id).subscribe(() => {
      this.toast.success('Conta excluída');
      this.accounts.reload();
    });
  }

  protected onPick(account: Account, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // allows sending the same file again (to see duplicate detection)
    void this.upload(account, files);
  }

  protected onDrop(account: Account, event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(null);
    void this.upload(account, Array.from(event.dataTransfer?.files ?? []));
  }

  protected async undoImport(account: Account): Promise<void> {
    const summary = this.results()[account.id];
    if (!summary?.importIds.length) return;
    const ok = await this.confirm.ask({
      title: 'Desfazer importação?',
      message: `${summary.imported} transação(ões) adicionada(s) neste envio serão apagadas, com as categorias ajustadas nelas.`,
      confirmText: 'Desfazer',
      destructive: true,
    });
    if (!ok) return;
    forkJoin(summary.importIds.map((id) => this.api.undoImport(account.id, id))).subscribe(() => {
      this.results.update(({ [account.id]: _undone, ...others }) => others);
      this.toast.success('Importação desfeita');
      this.accounts.reload();
      this.store.reload();
    });
  }

  /** One file at a time: each import is its own database transaction, and a bad file does not stop the others. */
  private async upload(account: Account, files: File[]): Promise<void> {
    const supported = files.filter((file) => ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext)));
    if (supported.length < files.length) this.toast.error('Formato não suportado', 'Envie um arquivo .ofx ou .csv.');
    if (!supported.length) return;

    this.busy.set(account.id);
    const summary: UploadSummary = { total: 0, imported: 0, duplicates: 0, categorized: 0, importIds: [] };
    let succeeded = 0;
    for (const file of supported) {
      try {
        const result: ImportResult = await firstValueFrom(this.api.importStatement(account.id, file));
        summary.total += result.total;
        summary.imported += result.imported;
        summary.duplicates += result.duplicates;
        summary.categorized += result.categorized;
        if (result.importId) summary.importIds.push(result.importId);
        succeeded++;
      } catch {
        // The HTTP interceptor already showed the error for this file.
      }
    }
    this.busy.set(null);

    if (succeeded) {
      this.results.update((all) => ({ ...all, [account.id]: summary }));
      this.accounts.reload(); // refresh count and "até" date
      this.store.reload();
    }
  }
}
