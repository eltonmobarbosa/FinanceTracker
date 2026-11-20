// Mirrors the API DTOs (FinanceTracker.Application). Dates travel as "YYYY-MM-DD", money as numbers.

export type AccountType = 'Checking' | 'CreditCard';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
}

export interface CategoryRule {
  id: number;
  pattern: string;
  priority: number;
}

export interface Category {
  id: number;
  name: string;
  isTransfer: boolean;
  rules: CategoryRule[];
}

export interface Transaction {
  id: number;
  date: string;
  amount: number;
  description: string;
  accountId: number;
  accountName: string;
  categoryId: number | null;
  categoryName: string | null;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  categorized: number;
}

export interface Summary {
  income: number;
  expenses: number;
  expensesByCategory: { categoryId: number | null; name: string; total: number }[];
  byMonth: { year: number; month: number; income: number; expenses: number }[];
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  email: string;
}

/** RFC 9457 error body returned by every API error. */
export interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
}
