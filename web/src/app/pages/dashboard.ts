import { CurrencyPipe, PercentPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { CategoryStore } from '../core/category-store';
import { FinanceApi } from '../core/finance-api';
import { BrDatePipe, PERIOD_LABELS, PeriodPreset, formatBRL, formatBRLCompact, monthLabel, periodRange } from '../core/format';
import { Paged, Summary, Transaction } from '../core/models';
import { ThemeService } from '../core/theme.service';
import { ChartView, token } from '../shared/chart';
import { Icon, IconName } from '../shared/icon';

const PRESETS: PeriodPreset[] = ['month', '3m', '6m', '12m', 'all'];

@Component({
  selector: 'app-dashboard-page',
  imports: [CurrencyPipe, PercentPipe, RouterLink, ChartView, Icon, BrDatePipe],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p class="mt-1 text-sm text-muted-foreground">Entradas e gastos de {{ periodLabel() }}.</p>
      </div>
      <div class="flex max-w-full min-w-0 flex-wrap items-center gap-2">
        <select class="input h-9 w-auto" aria-label="Conta" [value]="accountId()" (change)="accountId.set($any($event.target).value)">
          <option value="">Todas as contas</option>
          @for (a of accounts.value(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
        </select>
        <div class="segmented" role="group" aria-label="Período">
          @for (p of presets; track p) {
            <button [attr.aria-pressed]="period() === p" (click)="period.set(p)">{{ labels[p] }}</button>
          }
        </div>
      </div>
    </div>

    @if (uncategorized(); as count) {
      <a routerLink="/transacoes" [queryParams]="{ uncategorized: true }"
         class="mt-6 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm transition-colors hover:border-warning/60">
        <app-icon name="sparkles" class="text-warning" />
        <span class="flex-1"><strong>{{ count }} {{ count === 1 ? 'transação está' : 'transações estão' }} sem categoria.</strong>
          Categorize e crie regras para as próximas importações.</span>
        <span class="font-medium">Revisar</span>
        <app-icon name="chevron-right" />
      </a>
    }

    @if (summary.value(); as s) {
      @if (hasNoData()) {
        <div class="card mt-6 flex flex-col items-center px-6 py-16 text-center">
          <span class="grid size-12 place-items-center rounded-full bg-muted"><app-icon name="file-up" [size]="22" /></span>
          <h2 class="mt-4 text-lg font-semibold">{{ accounts.value().length ? 'Nenhuma transação neste período' : 'Comece importando seu extrato' }}</h2>
          <p class="mt-1 max-w-sm text-sm text-muted-foreground">
            {{ accounts.value().length ? 'Escolha outro período ou importe um extrato mais recente.' : 'Crie uma conta, envie o arquivo OFX ou CSV do seu banco e veja seus gastos organizados.' }}
          </p>
          <div class="mt-6 flex gap-2">
            @if (accounts.value().length) { <button class="btn btn-outline" (click)="period.set('all')">Ver todo o período</button> }
            <a routerLink="/contas" class="btn btn-primary"><app-icon name="file-up" /> Importar extrato</a>
          </div>
        </div>
      } @else {
        <section class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          @for (k of kpis(); track k.label) {
            <div class="card p-4 sm:p-5">
              <div class="flex items-center justify-between text-sm text-muted-foreground">
                {{ k.label }}
                <span class="hidden size-8 place-items-center rounded-md sm:grid" [class]="k.iconClass"><app-icon [name]="k.icon" /></span>
              </div>
              <p class="tabular mt-2 text-lg font-semibold tracking-tight sm:text-2xl" [class]="k.valueClass">{{ k.value }}</p>
              <p class="mt-1 hidden text-xs text-muted-foreground sm:block">{{ k.hint }}</p>
            </div>
          }
        </section>

        <section class="mt-4 grid gap-4 lg:grid-cols-7">
          <div class="card flex flex-col lg:col-span-4">
            <div class="card-header">
              <div>
                <h2 class="card-title">Fluxo mensal</h2>
                <p class="card-description">Entradas e gastos de cada mês</p>
              </div>
              <div class="flex gap-4 text-xs text-muted-foreground">
                <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-positive"></span>Entradas</span>
                <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-zinc-400 dark:bg-zinc-500"></span>Gastos</span>
              </div>
            </div>
            <!-- Grows with the card next to it; the chart fills whatever height is left. -->
            <div class="card-content relative min-h-72 flex-1">
              <app-chart class="!absolute inset-5" [config]="monthChart()" label="Gráfico de entradas e gastos por mês" />
            </div>
          </div>

          <div class="card lg:col-span-3">
            <div class="card-header">
              <div>
                <h2 class="card-title">Para onde foi o dinheiro</h2>
                <p class="card-description">Gastos por categoria</p>
              </div>
            </div>
            <div class="card-content">
              <div class="relative mx-auto size-44">
                <app-chart class="size-44" [config]="categoryChart()" label="Gráfico de gastos por categoria" />
                <div class="pointer-events-none absolute inset-0 grid place-content-center text-center">
                  <span class="text-xs text-muted-foreground">Total</span>
                  <span class="tabular text-lg font-semibold">{{ s.expenses | currency: 'BRL' : 'symbol' : '1.0-0' }}</span>
                </div>
              </div>
              <ul class="mt-5 space-y-1">
                @for (c of s.expensesByCategory.slice(0, 6); track c.categoryId) {
                  <li>
                    <a class="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                       routerLink="/transacoes" [queryParams]="c.categoryId === null ? { uncategorized: true } : { categoryId: c.categoryId }">
                      <span class="size-2.5 shrink-0 rounded-full" [style.background]="store.colorOf(c.categoryId)"></span>
                      <span class="flex-1 truncate">{{ c.name }}</span>
                      <span class="w-10 text-right text-xs text-muted-foreground">{{ c.total / s.expenses | percent }}</span>
                      <span class="tabular w-24 text-right font-medium">{{ c.total | currency }}</span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          </div>
        </section>

        <section class="card mt-4">
          <div class="card-header">
            <div>
              <h2 class="card-title">Transações recentes</h2>
              <p class="card-description">As últimas movimentações de todas as contas</p>
            </div>
            <a routerLink="/transacoes" class="btn btn-outline btn-sm">Ver todas <app-icon name="chevron-right" [size]="14" /></a>
          </div>
          <ul class="card-content divide-y">
            @for (t of recent.value()?.items; track t.id) {
              <li class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span class="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                      [style.background]="store.colorOf(t.categoryId)">{{ t.description.charAt(0) }}</span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ t.description }}</p>
                  <p class="text-xs text-muted-foreground">{{ t.date | brDate }} · {{ t.categoryName ?? 'Sem categoria' }}</p>
                </div>
                <span class="tabular text-sm font-medium" [class.text-positive]="t.amount > 0">
                  {{ t.amount > 0 ? '+' : '' }}{{ t.amount | currency }}
                </span>
              </li>
            }
          </ul>
        </section>
      }
    } @else {
      <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-32"></div> }
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-7">
        <div class="skeleton h-96 lg:col-span-4"></div>
        <div class="skeleton h-96 lg:col-span-3"></div>
      </div>
    }
  `,
})
export class DashboardPage {
  protected readonly store = inject(CategoryStore);
  private readonly theme = inject(ThemeService);

  protected readonly presets = PRESETS;
  protected readonly labels = PERIOD_LABELS;
  protected readonly period = signal<PeriodPreset>('6m');
  protected readonly accountId = signal('');
  protected readonly periodLabel = computed(() =>
    this.period() === 'all' ? 'todo o período' : PERIOD_LABELS[this.period()].toLowerCase());

  protected readonly accounts = inject(FinanceApi).accounts();

  protected readonly summary = httpResource<Summary>(() => {
    const params: Record<string, string> = { ...periodRange(this.period()) };
    if (this.accountId()) params['accountId'] = this.accountId();
    return { url: '/api/reports/summary', params };
  });

  private readonly uncategorizedPage = httpResource<Paged<Transaction>>(() => ({
    url: '/api/transactions', params: { uncategorized: true, pageSize: 1 },
  }));
  protected readonly uncategorized = computed(() => this.uncategorizedPage.value()?.totalCount ?? 0);

  protected readonly recent = httpResource<Paged<Transaction>>(() => ({
    url: '/api/transactions', params: { pageSize: 6, ...(this.accountId() ? { accountId: this.accountId() } : {}) },
  }));

  protected readonly hasNoData = computed(() => (this.summary.value()?.byMonth.length ?? 0) === 0);

  protected readonly kpis = computed(() => {
    const s = this.summary.value();
    if (!s) return [];
    const balance = s.income - s.expenses;
    const savingsRate = s.income > 0 ? balance / s.income : 0;
    const kpis: { label: string; value: string; hint: string; icon: IconName; iconClass: string; valueClass: string }[] = [
      { label: 'Entradas', value: formatBRL(s.income), hint: 'Salário, Pix recebidos, estornos', icon: 'arrow-down-left', iconClass: 'bg-positive-soft text-positive', valueClass: '' },
      { label: 'Gastos', value: formatBRL(s.expenses), hint: `Em ${s.expensesByCategory.length} categorias`, icon: 'arrow-up-right', iconClass: 'bg-muted text-foreground', valueClass: '' },
      { label: 'Saldo do período', value: formatBRL(balance), hint: balance >= 0 ? 'Sobrou dinheiro' : 'Gastou mais do que entrou', icon: 'wallet', iconClass: balance >= 0 ? 'bg-positive-soft text-positive' : 'bg-destructive-soft text-destructive', valueClass: balance >= 0 ? 'text-positive' : 'text-destructive' },
      { label: 'Taxa de economia', value: `${Math.round(savingsRate * 100)}%`, hint: 'Do que entrou, quanto sobrou', icon: 'piggy-bank', iconClass: 'bg-muted text-foreground', valueClass: '' },
    ];
    return kpis;
  });

  protected readonly monthChart = computed<ChartConfiguration>(() => {
    this.theme.theme(); // re-read colors when the theme changes
    const months = this.summary.value()?.byMonth ?? [];
    const dark = this.theme.theme() === 'dark';
    const grid = token('border');
    const text = token('muted-foreground');
    return {
      type: 'bar',
      data: {
        labels: months.map((m) => monthLabel(m.year, m.month)),
        datasets: [
          { label: 'Entradas', data: months.map((m) => m.income), backgroundColor: dark ? '#34d399' : '#10b981', borderRadius: 6, maxBarThickness: 28 },
          { label: 'Gastos', data: months.map((m) => m.expenses), backgroundColor: dark ? '#71717a' : '#a1a1aa', borderRadius: 6, maxBarThickness: 28 },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${formatBRL(c.parsed.y ?? 0)}` } },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: text } },
          y: { grid: { color: grid }, border: { display: false }, ticks: { color: text, callback: (v) => formatBRLCompact(Number(v)) } },
        },
      },
    };
  });

  protected readonly categoryChart = computed<ChartConfiguration>(() => {
    const categories = this.summary.value()?.expensesByCategory ?? [];
    return {
      type: 'doughnut',
      data: {
        labels: categories.map((c) => c.name),
        datasets: [{
          data: categories.map((c) => c.total),
          backgroundColor: categories.map((c) => this.store.colorOf(c.categoryId)),
          borderWidth: 0,
          spacing: 2,
          borderRadius: 4,
        }],
      },
      options: {
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${formatBRL(Number(c.parsed))}` } },
        },
      },
    };
  });
}
