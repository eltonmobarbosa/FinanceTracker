import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

/** Layout of every logged-in page: top navigation + page content. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand">Finance<span>Tracker</span></a>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Painel</a>
        <a routerLink="/transacoes" routerLinkActive="active">Transações</a>
        <a routerLink="/importar" routerLinkActive="active">Contas e importação</a>
        <a routerLink="/categorias" routerLinkActive="active">Categorias</a>
      </nav>
      <div class="user">
        <span class="muted">{{ auth.email() }}</span>
        <button class="secondary" (click)="auth.logout()">Sair</button>
      </div>
    </header>
    <main class="page">
      <router-outlet />
    </main>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
}
