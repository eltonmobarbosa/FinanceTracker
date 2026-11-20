import { Component, ElementRef, effect, inject, input } from '@angular/core';
import {
  ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleAlert, CreditCard, Eye,
  EyeOff, FileUp, Inbox, Landmark, LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, Pencil, PiggyBank, Plus,
  Search, Sparkles, Sun, Tags, Trash2, Wallet, X, type IconNode,
} from 'lucide';

/**
 * Lucide icons (ISC license), drawn from their path data with createElementNS — no innerHTML.
 * Only icons imported here are bundled. (lucide-angular does not support Angular 22 yet, hence this 40-line component.)
 */
const ICONS = {
  'arrow-left-right': ArrowLeftRight, 'arrow-down-left': ArrowDownLeft, 'arrow-up-right': ArrowUpRight, check: Check,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, alert: CircleAlert, 'credit-card': CreditCard, eye: Eye,
  'eye-off': EyeOff, 'file-up': FileUp, inbox: Inbox, landmark: Landmark, dashboard: LayoutDashboard,
  loader: LoaderCircle, 'log-out': LogOut, menu: Menu, moon: Moon, pencil: Pencil, 'piggy-bank': PiggyBank,
  plus: Plus, search: Search, sparkles: Sparkles, sun: Sun, tags: Tags, trash: Trash2, wallet: Wallet, x: X,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

const SVG_NS = 'http://www.w3.org/2000/svg';

@Component({
  selector: 'app-icon',
  template: '',
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(16);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      const svg = document.createElementNS(SVG_NS, 'svg');
      const attrs: Record<string, string> = {
        width: `${this.size()}`, height: `${this.size()}`, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      };
      Object.entries(attrs).forEach(([k, v]) => svg.setAttribute(k, v));

      for (const [tag, nodeAttrs] of ICONS[this.name()]) {
        const child = document.createElementNS(SVG_NS, tag);
        Object.entries(nodeAttrs).forEach(([k, v]) => child.setAttribute(k, String(v)));
        svg.appendChild(child);
      }
      this.host.nativeElement.replaceChildren(svg);
    });
  }
}
