import { Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "'Inter Variable', system-ui, sans-serif";

/** Thin wrapper around Chart.js: redraws whenever the `config` input changes. */
@Component({
  selector: 'app-chart',
  template: '<canvas #canvas [attr.aria-label]="label()" role="img"></canvas>',
  host: { class: 'block relative' },
})
export class ChartView {
  readonly config = input.required<ChartConfiguration>();
  readonly label = input('');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const config = this.config();
      this.chart?.destroy();
      this.chart = new Chart(this.canvas().nativeElement, {
        ...config,
        options: { responsive: true, maintainAspectRatio: false, ...config.options },
      });
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}

/** Reads a design token (CSS variable) so charts follow the light/dark theme. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}
