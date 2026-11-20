import { httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Category } from './models';

/** Tailwind 500 shades, ordered so neighbors (in creation order) contrast. */
const PALETTE = [
  '#f59e0b', '#0ea5e9', '#8b5cf6', '#ec4899', '#ef4444', '#6366f1',
  '#14b8a6', '#f97316', '#10b981', '#06b6d4', '#84cc16', '#a855f7',
];
export const UNCATEGORIZED_COLOR = '#a1a1aa';
/** Transfers are "not spending": neutral on purpose. */
const TRANSFER_COLOR = '#64748b';

/**
 * The user's categories, loaded once and shared by every page, plus a stable color per category
 * (by creation order), so "Alimentação" has the same color in the chart, the table and the categories page.
 */
@Injectable({ providedIn: 'root' })
export class CategoryStore {
  private readonly auth = inject(AuthService);

  // Depends on the logged-in user: logging in as someone else re-fetches instead of showing stale data.
  readonly categories = httpResource<Category[]>(
    () => (this.auth.email() ? { url: '/api/categories' } : undefined),
    { defaultValue: [] },
  );

  private readonly colors = computed(() => {
    const regular = [...this.categories.value()].filter((c) => !c.isTransfer).sort((a, b) => a.id - b.id);
    const map = new Map(regular.map((c, i) => [c.id, PALETTE[i % PALETTE.length]]));
    this.categories.value().filter((c) => c.isTransfer).forEach((c) => map.set(c.id, TRANSFER_COLOR));
    return map;
  });

  colorOf(categoryId: number | null): string {
    return categoryId === null ? UNCATEGORIZED_COLOR : (this.colors().get(categoryId) ?? UNCATEGORIZED_COLOR);
  }

  reload(): void {
    this.categories.reload();
  }
}
