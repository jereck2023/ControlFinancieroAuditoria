import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationDialog } from '../../../shared/ui/confirmation-dialog';
import { FieldError } from '../../../shared/forms/field-error';
import { AlertDetailResponse } from '../models/responses/alert-responses';
import { AlertAction, ClosedAlertState } from '../models/requests/alert-requests';
import { alertStateLabel, closeJustification, validAlertVersion } from '../models/alert-view';
@Component({
  selector: 'app-alert-actions',
  imports: [ReactiveFormsModule, ConfirmationDialog, FieldError],
  templateUrl: './alert-actions.html',
  styles: `
    .justification-preview {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      max-height: 12rem;
      overflow-y: auto;
    }
  `,
})
export class AlertActions {
  readonly alert = input.required<AlertDetailResponse>();
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly error = input('');
  readonly action = output<AlertAction>();
  readonly prepare = output<void>();
  private readonly fb = inject(FormBuilder);
  protected readonly form = this.fb.nonNullable.group({
    estado: this.fb.nonNullable.control<ClosedAlertState>('Resuelta'),
    justificacion: this.fb.nonNullable.control('', closeJustification),
  });
  protected readonly pending = signal<AlertAction | null>(null);
  protected readonly label = alertStateLabel;
  constructor() {
    let id: number | undefined, version: string | undefined;
    effect(() => {
      const alert = this.alert();
      if (alert.alertaId !== id) this.form.reset({ estado: 'Resuelta', justificacion: '' });
      if (this.disabled() || version !== alert.rowVersion) this.pending.set(null);
      id = alert.alertaId;
      version = alert.rowVersion;
    });
  }
  protected prepareStart(): void {
    const item = this.alert();
    if (
      !this.busy() &&
      !this.disabled() &&
      item.estado === 'Pendiente' &&
      validAlertVersion(item.rowVersion)
    ) {
      this.prepare.emit();
      this.pending.set({ kind: 'start', request: { rowVersion: item.rowVersion } });
    }
  }
  protected prepareClose(): void {
    this.form.markAllAsTouched();
    const item = this.alert();
    if (
      this.busy() ||
      this.disabled() ||
      !this.form.valid ||
      item.estado !== 'En revision' ||
      !validAlertVersion(item.rowVersion)
    )
      return;
    const value = this.form.getRawValue();
    this.prepare.emit();
    this.pending.set({
      kind: 'close',
      request: {
        estado: value.estado,
        justificacion: value.justificacion.trim(),
        rowVersion: item.rowVersion,
      },
    });
  }
  protected confirm(): void {
    const pending = this.pending();
    if (pending && !this.busy() && !this.disabled()) this.action.emit(pending);
  }
}
