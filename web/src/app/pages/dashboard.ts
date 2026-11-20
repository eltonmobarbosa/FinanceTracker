import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { firstDay, lastDay, monthLabel, monthsAgo } from '../core/format';
import { Summary } from '../core/models';
import { ChartView } from '../shared/chart';

const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16', '#64748b'];

@Component({
  selector: 'app-dashboard-page',
  imports: [CurrencyPipe, DecimalPipe, FormsModule, RouterLink, ChartView],
  template: `
    <div class="page-header">
      <h1>Painel</h1>
      <div class="filters">
        <label>De <input type="month" [ngModel]="from()" (ngModelChange)="from.set($event)" /></label>
        <label>Até <input type="month" [ngModel]="to()" (ngModelChange)="to.set($event)" /></label>
      </div>
    </div>

    @if (summary.value(); as s) {
      <section class="kpis">
        <div class="card kpi">
          <span class="muted">Entradas</span>
          <strong class="positive">{{ s.income | currency }}</strong>
        </div>
        <div class="card kpi">
          <span class="muted">Gastos</span>
          <strong class="negative">{{ s.expenses | currency }}</strong>
        </div>
        <div class="card kpi">
          <span class="muted">Saldo do período</span>
          <strong [class.positive]="s.income - s.expenses >= 0" [class.negative]="s.income - s.expenses < 0">
            {{ s.income - s.expenses | currency }}
          </strong>
        </div>
      </section>

      @if (s.byMonth.length === 0) {
        <div class="card empty">
          <p>Nenhuma transação neste período.</p>
          <a routerLink="/importar" class="button">Importar extrato</a>
        </div>
      } @else {
        <section class="grid-2">
          <div class="card">
            <h2>Para onde foi o dinheiro</h2>
            <app-chart [config]="categoryChart()" />
          </div>
          <div class="card">
            <h2>Entradas e gastos por mês</h2>
            <app-chart [config]="monthChart()" />
          </div>
        </section>

        <section class="card">
          <h2>Gastos por categoria</h2>
          <table>
            <tbody>
              @for (c of s.expensesByCategory; track c.categoryId) {
                <tr>
                  <td>
                    <a [routerLink]="['/transacoes']"
                       [queryParams]="c.categoryId === null ? { uncategorized: true } : { categoryId: c.categoryId }">
                      {{ c.name }}
                    </a>
                  </td>
                  <td class="bar-cell"><div class="bar" [style.width.%]="(c.total / s.expenses) * 100"></div></td>
                  <td class="num">{{ (c.total / s.expenses) * 100 | number: '1.0-0' }}%</td>
                  <td class="num">{{ c.total | currency }}</td>
                </tr>
              }
            </tbody>
          </table>
          <p class="muted small">Transferências entre suas contas (ex.: pagamento da fatura) não entram nos totais.</p>
        </section>
      }
    } @else if (summary.isLoading()) {
      <p class="muted">Carregando…</p>
    }
  `,
})
export class DashboardPage {
  protected readonly from = signal(monthsAgo(5));
  protected readonly to = signal(monthsAgo(0));

  // Re-fetches automatically whenever from/to change.
  protected readonly summary = httpResource<Summary>(() => ({
    url: '/api/reports/summary',
    params: { from: firstDay(this.from()), to: lastDay(this.to()) },
  }));

  protected readonly categoryChart = computed<ChartConfiguration>(() => {
    const categories = this.summary.value()?.expensesByCategory ?? [];
    return {
      type: 'doughnut',
      data: {
        labels: categories.map((c) => c.name),
        datasets: [{ data: categories.map((c) => c.total), backgroundColor: PALETTE }],
      },
      options: { plugins: { legend: { position: 'right' } } },
    };
  });

  protected readonly monthChart = computed<ChartConfiguration>(() => {
    const months = this.summary.value()?.byMonth ?? [];
    return {
      type: 'bar',
      data: {
        labels: months.map((m) => monthLabel(m.year, m.month)),
        datasets: [
          { label: 'Entradas', data: months.map((m) => m.income), backgroundColor: '#10b981' },
          { label: 'Gastos', data: months.map((m) => m.expenses), backgroundColor: '#ef4444' },
        ],
      },
    };
  });
}
