import { Component, Injectable, inject, signal } from '@angular/core';
import { Modal } from './modal';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  destructive?: boolean;
}

/** `await confirm.ask({...})` — a styled replacement for window.confirm(). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => this.current.set({ ...options, resolve }));
  }

  answer(ok: boolean): void {
    this.current()?.resolve(ok);
    this.current.set(null);
  }
}

/** Rendered once, in the root component. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal],
  template: `
    <dialog class="modal" [appModal]="confirm.current() !== null" (appModalChange)="!$event && confirm.answer(false)"
            aria-labelledby="confirm-title">
      @if (confirm.current(); as c) {
        <div class="p-6">
          <h2 id="confirm-title" class="text-lg font-semibold">{{ c.title }}</h2>
          <p class="mt-2 text-sm text-muted-foreground">{{ c.message }}</p>
          <div class="mt-6 flex justify-end gap-2">
            <button class="btn btn-outline" (click)="confirm.answer(false)">Cancelar</button>
            <button class="btn" [class.btn-destructive]="c.destructive" [class.btn-primary]="!c.destructive"
                    (click)="confirm.answer(true)">{{ c.confirmText }}</button>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
}
