import { Pipe, PipeTransform } from '@angular/core';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL_COMPACT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' });

export const formatBRL = (value: number) => BRL.format(value);
export const formatBRLCompact = (value: number) => BRL_COMPACT.format(value);

/**
 * "2026-10-16" -> "16 out. 2026" (or "16/10/2026" with format "short").
 * Not DatePipe: it parses a date-only string as UTC midnight, which in Brazil (UTC-3) shows the previous day.
 */
@Pipe({ name: 'brDate' })
export class BrDatePipe implements PipeTransform {
  transform(isoDate: string, format: 'short' | 'long' = 'long'): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    if (format === 'short') return `${pad(day)}/${pad(month)}/${year}`;
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

/** "out. 26" */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

export type PeriodPreset = 'month' | 'last-month' | '3m' | '6m' | '12m' | 'all';

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  month: 'Este mês',
  'last-month': 'Mês passado',
  '3m': '3 meses',
  '6m': '6 meses',
  '12m': '12 meses',
  all: 'Todo período',
};

/** Date range of a preset, as "YYYY-MM-DD"; "3m" = the current month plus the two before it. */
export function periodRange(preset: PeriodPreset, today = new Date()): { from?: string; to?: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const endOfMonth = (offset: number) => iso(new Date(y, m + offset + 1, 0));
  const startOfMonth = (offset: number) => iso(new Date(y, m + offset, 1));

  switch (preset) {
    case 'month': return { from: startOfMonth(0), to: endOfMonth(0) };
    case 'last-month': return { from: startOfMonth(-1), to: endOfMonth(-1) };
    case '3m': return { from: startOfMonth(-2), to: endOfMonth(0) };
    case '6m': return { from: startOfMonth(-5), to: endOfMonth(0) };
    case '12m': return { from: startOfMonth(-11), to: endOfMonth(0) };
    case 'all': return {};
  }
}

/** Suggests a rule pattern from a description: drops the installment suffix, card ids and numbers. */
export function suggestPattern(description: string): string {
  return description
    .replace(/\s*-\s*parcela.*$/i, '')
    .replace(/\s*\*.*$/, '') // "Uber *Trip" -> "Uber", "Mercado Livre*Loja" -> "Mercado Livre"
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
