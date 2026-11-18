import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-information-dialog',
  template: `<dialog
    #dialog
    aria-labelledby="information-title"
    (cancel)="cancel($event)"
    (keydown)="keepFocus($event)"
  >
    <header class="panel-heading">
      <h2 id="information-title">{{ title() }}</h2>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm"
        autofocus
        [disabled]="busy()"
        (click)="dismiss.emit()"
      >
        Cerrar
      </button>
    </header>
    <div class="information-body"><ng-content /></div>
  </dialog>`,
  styleUrl: './information-dialog.scss',
})
export class InformationDialog {
  readonly title = input.required<string>();
  readonly busy = input(false);
  readonly dismiss = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  constructor() {
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.dialog().nativeElement;
      const root = document.documentElement;
      const window = document.defaultView;
      const opener = document.activeElement;
      const x = window?.scrollX ?? 0,
        y = window?.scrollY ?? 0;
      const overflow = root.style.overflow,
        gutter = root.style.scrollbarGutter;
      const minHeight = root.style.minHeight;
      const scrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      root.style.minHeight = `${root.scrollHeight}px`;
      root.style.scrollbarGutter = 'stable';
      root.style.overflow = 'hidden';
      element.showModal();
      window?.scrollTo({ left: x, top: y, behavior: 'instant' });
      destroyRef.onDestroy(() => {
        element.close();
        root.style.overflow = overflow;
        root.style.scrollbarGutter = gutter;
        root.style.minHeight = minHeight;
        if (opener instanceof HTMLElement && opener.isConnected)
          opener.focus({ preventScroll: true });
        window?.scrollTo({ left: x, top: y, behavior: 'instant' });
        root.style.scrollBehavior = scrollBehavior;
      });
    });
  }
  protected cancel(event: Event): void {
    if (event.target !== this.dialog().nativeElement) return;
    event.preventDefault();
    if (!this.busy()) this.dismiss.emit();
  }
  protected keepFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const dialog = this.dialog().nativeElement;
    // A nested confirmation owns its own keyboard navigation.
    if (event.target instanceof Element && event.target.closest('dialog') !== dialog) return;
    const controls = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => element.getClientRects().length > 0 && element.tabIndex >= 0);
    const target = event.shiftKey ? controls.at(-1) : controls[0];
    const edge = event.shiftKey ? controls[0] : controls.at(-1);
    if (
      dialog.ownerDocument.activeElement === edge ||
      !dialog.contains(dialog.ownerDocument.activeElement)
    ) {
      event.preventDefault();
      target?.focus({ preventScroll: true });
    }
  }
}
