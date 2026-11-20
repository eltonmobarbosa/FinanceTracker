import { Directive, ElementRef, effect, inject, model } from '@angular/core';

/**
 * Binds a native <dialog> to a boolean signal: `<dialog class="modal" [(appModal)]="open">`.
 * showModal() gives focus trap, Esc to close and the backdrop for free; closing by Esc or by clicking
 * the backdrop writes `false` back to the signal.
 */
@Directive({
  selector: 'dialog[appModal]',
  host: {
    '(close)': 'onClose()',
    '(click)': 'closeOnBackdrop($event)',
  },
})
export class Modal {
  readonly open = model.required<boolean>({ alias: 'appModal' });
  private readonly dialog = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      if (this.open() && !this.dialog.open) this.dialog.showModal();
      if (!this.open() && this.dialog.open) this.dialog.close();
    });
  }

  // The browser fires "close" as a queued task. If the dialog was reopened in the meantime, that event is stale
  // and must not close the new one.
  protected onClose(): void {
    if (!this.dialog.open) this.open.set(false);
  }

  // A click whose target is the <dialog> itself landed on the backdrop (the content is inside child elements).
  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog) this.open.set(false);
  }
}
