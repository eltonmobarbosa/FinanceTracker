import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';
import { ToastService } from './core/toast.service';
import { ConfirmDialog } from './shared/confirm';
import { Icon } from './shared/icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialog, Icon],
  template: `
    <router-outlet />
    <app-confirm-dialog />

    <ol class="fixed right-4 bottom-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <li role="status" class="card flex items-start gap-3 p-4 shadow-lg animate-[modal-in_.2s_ease-out]">
          <span class="mt-0.5" [class.text-positive]="toast.kind === 'success'" [class.text-destructive]="toast.kind === 'error'">
            <app-icon [name]="toast.kind === 'success' ? 'check' : 'alert'" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{{ toast.title }}</p>
            @if (toast.description) { <p class="mt-0.5 text-sm text-muted-foreground">{{ toast.description }}</p> }
          </div>
          <button class="btn btn-ghost btn-icon -m-1 size-6" (click)="toasts.dismiss(toast.id)" aria-label="Fechar notificação">
            <app-icon name="x" [size]="14" />
          </button>
        </li>
      }
    </ol>
  `,
})
export class App {
  protected readonly toasts = inject(ToastService);

  constructor() {
    inject(ThemeService); // applies the saved theme before the first paint of any page
  }
}
