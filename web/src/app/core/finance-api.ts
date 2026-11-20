import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Account, AccountType, Category, CategoryRule, ImportResult } from './models';
// Categories are read through CategoryStore (shared cache + colors).

/**
 * Every API endpoint in one place.
 * Reads return an httpResource (a signal that loads, exposes value/isLoading/error and can reload);
 * they must be created in a component field initializer (injection context).
 * Writes return Observables.
 */
@Injectable({ providedIn: 'root' })
export class FinanceApi {
  private readonly http = inject(HttpClient);

  accounts() {
    return httpResource<Account[]>(() => '/api/accounts', { defaultValue: [] });
  }

  createAccount(name: string, type: AccountType): Observable<Account> {
    return this.http.post<Account>('/api/accounts', { name, type });
  }

  deleteAccount(id: number): Observable<void> {
    return this.http.delete<void>(`/api/accounts/${id}`);
  }

  importStatement(accountId: number, file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportResult>(`/api/accounts/${accountId}/imports`, form);
  }

  createCategory(name: string, isTransfer: boolean): Observable<Category> {
    return this.http.post<Category>('/api/categories', { name, isTransfer });
  }

  updateCategory(id: number, name: string, isTransfer: boolean): Observable<Category> {
    return this.http.put<Category>(`/api/categories/${id}`, { name, isTransfer });
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`/api/categories/${id}`);
  }

  addRule(categoryId: number, pattern: string, priority = 0): Observable<CategoryRule> {
    return this.http.post<CategoryRule>(`/api/categories/${categoryId}/rules`, { pattern, priority });
  }

  deleteRule(ruleId: number): Observable<void> {
    return this.http.delete<void>(`/api/categories/rules/${ruleId}`);
  }

  categorize(transactionId: number, categoryId: number | null, rulePattern?: string) {
    return this.http.put<{ alsoCategorized: number }>(`/api/transactions/${transactionId}/category`, {
      categoryId,
      rulePattern: rulePattern || null,
    });
  }
}
