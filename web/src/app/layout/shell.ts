import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { Icon, IconName } from '../shared/icon';

const NAV: { path: string; label: string; icon: IconName; exact?: boolean }[] = [
  { path: '/', label: 'Visão geral', icon: 'dashboard', exact: true },
  { path: '/transacoes', label: 'Transações', icon: 'arrow-left-right' },
  { path: '/contas', label: 'Contas e importação', icon: 'wallet' },
  { path: '/categorias', label: 'Categorias e regras', icon: 'tags' },
];

/** Layout of every logged-in page: sidebar (drawer on mobile) + content. Pattern of shadcn's "sidebar" block. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
    <div class="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <!-- Mobile top bar -->
      <header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-sidebar/90 px-4 backdrop-blur lg:hidden">
        <button class="btn btn-ghost btn-icon" (click)="menuOpen.set(true)" aria-label="Abrir menu">
          <app-icon name="menu" [size]="18" />
        </button>
        <span class="font-semibold">FinanceTracker</span>
      </header>

      @if (menuOpen()) {
        <div class="fixed inset-0 z-40 bg-black/40 lg:hidden" (click)="menuOpen.set(false)" aria-hidden="true"></div>
      }

      <!-- The column paints the sidebar background all the way down; the aside inside it stays fixed while scrolling. -->
      <div class="lg:border-r lg:bg-sidebar">
      <aside class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:border-r-0"
             [class.-translate-x-full]="!menuOpen()" aria-label="Menu principal">
        <div class="flex h-16 items-center gap-2.5 px-5">
          <span class="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <app-icon name="piggy-bank" [size]="18" />
          </span>
          <span class="font-semibold tracking-tight">FinanceTracker</span>
          <button class="btn btn-ghost btn-icon ml-auto size-8 lg:hidden" (click)="menuOpen.set(false)" aria-label="Fechar menu">
            <app-icon name="x" />
          </button>
        </div>

        <nav class="flex flex-1 flex-col gap-1 px-3 py-2">
          <p class="px-3 pb-1 text-xs font-medium text-muted-foreground">Menu</p>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="bg-muted text-foreground font-medium"
               [routerLinkActiveOptions]="{ exact: !!item.exact }" ariaCurrentWhenActive="page"
               class="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <app-icon [name]="item.icon" />
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="border-t p-3">
          <div class="flex items-center gap-3 rounded-md p-2">
            <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold uppercase">{{ initial() }}</span>
            <span class="min-w-0 flex-1 truncate text-sm" [title]="auth.email()">{{ auth.email() }}</span>
          </div>
          <div class="mt-1 grid grid-cols-2 gap-1">
            <button class="btn btn-ghost btn-sm justify-start" (click)="theme.toggle()"
                    [attr.aria-label]="theme.theme() === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'">
              <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="14" />
              {{ theme.theme() === 'dark' ? 'Claro' : 'Escuro' }}
            </button>
            <button class="btn btn-ghost btn-sm justify-start" (click)="auth.logout()">
              <app-icon name="log-out" [size]="14" /> Sair
            </button>
          </div>
        </div>
      </aside>
      </div>

      <main class="min-w-0">
        <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly nav = NAV;
  protected readonly menuOpen = signal(false);
  protected readonly initial = computed(() => this.auth.email().charAt(0) || '?');

  constructor() {
    // Closes the mobile drawer after navigating.
    inject(Router).events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.menuOpen.set(false));
  }
}
