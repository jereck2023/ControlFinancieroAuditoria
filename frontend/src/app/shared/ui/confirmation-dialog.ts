import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { Feedback } from './feedback';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [Feedback],
  template: `<dialog
    #dialog
    aria-labelledby="confirmation-title"
    aria-describedby="confirmation-description"
    (cancel)="cancel($event)"
  >
    <h2 id="confirmation-title">{{ title() }}</h2>
    <p id="confirmation-description">{{ description() }}</p>
    <ng-content />
    <app-feedback [message]="error()" />
    <div class="d-flex gap-2 justify-content-end mt-4">
      <button
        type="button"
        class="btn btn-outline-secondary"
        autofocus
        [disabled]="busy()"
        (click)="dismiss.emit()"
      >
        Cancelar
      </button>
      <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="confirm.emit()">
        {{ busy() ? 'Procesando…' : 'Confirmar' }}
      </button>
    </div>
  </dialog>`,
})
export class ConfirmationDialog {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly busy = input(false);
  readonly error = input('');
  readonly confirm = output<void>();
  readonly dismiss = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
  cancel(event: Event): void {
    event.preventDefault();
    if (!this.busy()) this.dismiss.emit();
  }
}
