import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error';
  title: string;
  description?: string;
}

/** Notifications in the style of Sonner (shadcn's toast). Errors from every HTTP call end up here. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  success(title: string, description?: string): void {
    this.show({ kind: 'success', title, description });
  }

  error(title: string, description?: string): void {
    this.show({ kind: 'error', title, description });
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(toast: Omit<Toast, 'id'>): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [...list.slice(-2), { ...toast, id }]); // at most 3 on screen
    setTimeout(() => this.dismiss(id), 5000);
  }
}
