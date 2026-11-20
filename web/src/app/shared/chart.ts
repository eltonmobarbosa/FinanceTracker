import { Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

/** Thin wrapper around Chart.js: redraws whenever the `config` input changes. */
@Component({
  selector: 'app-chart',
  template: '<canvas #canvas></canvas>',
  host: { style: 'display:block; position:relative; height:280px' },
})
export class ChartView {
  readonly config = input.required<ChartConfiguration>();
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
