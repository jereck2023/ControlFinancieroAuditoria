import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FieldError } from '../forms/field-error';
import { TraceFiltersValue, optionalId, optionalUtcDate, utcDateRange } from './trace-query';

const defaults: TraceFiltersValue = {
  usuarioId: null,
  documentoFinancieroId: null,
  registroFinancieroId: null,
  tipoAccion: '',
  tipoActividad: '',
  fechaDesde: '',
  fechaHasta: '',
  tamanoPagina: 20,
};

@Component({
  selector: 'app-trace-filters',
  imports: [ReactiveFormsModule, FieldError],
  templateUrl: './trace-filters.html',
})
export class TraceFilters {
  readonly mode = input.required<'history' | 'activity'>();
  readonly busy = input(false);
  readonly apply = output<TraceFiltersValue>();
  private readonly fb = inject(FormBuilder);
  protected readonly form = this.fb.group(
    {
      usuarioId: this.fb.control<number | null>(null, optionalId),
      documentoFinancieroId: this.fb.control<number | null>(null, optionalId),
      registroFinancieroId: this.fb.control<number | null>(null, optionalId),
      tipoAccion: this.fb.nonNullable.control<TraceFiltersValue['tipoAccion']>(''),
      tipoActividad: this.fb.nonNullable.control(''),
      fechaDesde: this.fb.nonNullable.control('', optionalUtcDate),
      fechaHasta: this.fb.nonNullable.control('', optionalUtcDate),
      tamanoPagina: this.fb.nonNullable.control(20),
    },
    { validators: utcDateRange },
  );
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.valid && !this.busy()) this.apply.emit(this.form.getRawValue());
  }
  protected clear(): void {
    this.form.reset(defaults);
    this.submit();
  }
}
