import { Pipe, PipeTransform } from '@angular/core';

/**
 * "2026-10-16" -> "16/10/2026".
 * Not DatePipe: it parses a date-only string as UTC midnight, which in Brazil (UTC-3) shows the previous day.
 */
@Pipe({ name: 'brDate' })
export class BrDatePipe implements PipeTransform {
  transform(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }
}

/** "out. de 2026" */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

/** "2026-10" for the month n months before today (0 = current month). Matches <input type="month">. */
export function monthsAgo(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-10" -> "2026-10-01" */
export function firstDay(month: string): string {
  return `${month}-01`;
}

/** "2026-02" -> "2026-02-28" */
export function lastDay(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}`;
}

/** Suggests a rule pattern from a description: drops installment suffix and numbers. */
export function suggestPattern(description: string): string {
  return description
    .replace(/\s*-\s*parcela.*$/i, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
