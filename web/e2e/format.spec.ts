import { expect, test } from '@playwright/test';
import { periodRange, suggestPattern } from '../src/app/core/format';

// Pure functions: no browser or server involved.
test.describe('format helpers', () => {
  test('period ranges cross year and month boundaries', () => {
    expect(periodRange('3m', new Date(2026, 0, 31))).toEqual({ from: '2025-11-01', to: '2026-01-31' });
    expect(periodRange('last-month', new Date(2026, 2, 31))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('last-month', new Date(2028, 2, 1))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(periodRange('month', new Date(2026, 11, 15))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(periodRange('12m', new Date(2026, 10, 21))).toEqual({ from: '2025-12-01', to: '2026-11-30' });
    expect(periodRange('all')).toEqual({});
  });

  test('rule suggestion drops installments, card ids and numbers', () => {
    expect(suggestPattern('Uber *Trip')).toBe('Uber');
    expect(suggestPattern('Mercado Livre*Loja Exemplo')).toBe('Mercado Livre');
    expect(suggestPattern('Lojas Renner - Parcela 6/6')).toBe('Lojas Renner');
    expect(suggestPattern('Drogasil 1234')).toBe('Drogasil');
  });
});
