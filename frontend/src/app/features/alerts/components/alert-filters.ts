import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Session } from '../../../core/auth/session';
import { FieldError } from '../../../shared/forms/field-error';
import {
  optionalId,
  optionalPeruDate,
  peruDateRange,
  peruQueryDate,
} from '../../../shared/traceability/trace-query';
import { AlertState, AlertQuery } from '../models/requests/alert-requests';
@Component({
  selector: 'app-alert-filters',
  imports: [ReactiveFormsModule, FieldError],
  templateUrl: './alert-filters.html',
})
export class AlertFilters {
  readonly busy = input(false);
  readonly apply = output<AlertQuery>();
  private readonly fb = inject(FormBuilder);
  protected readonly auditor = inject(Session).identity()?.roles.includes('Auditor') ?? false;
  protected readonly form = this.fb.group(
    {
      estado: this.fb.nonNullable.control<AlertState | ''>(''),
      reglaAnomaliaId: this.fb.control<number | null>(null, optionalId),
      areaId: this.fb.control<number | null>(null, optionalId),
      usuarioId: this.fb.control<number | null>(null, optionalId),
      fechaDesde: this.fb.nonNullable.control('', optionalPeruDate),
      fechaHasta: this.fb.nonNullable.control('', optionalPeruDate),
      tamanoPagina: this.fb.nonNullable.control(20),
    },
    { validators: peruDateRange },
  );
  protected submit(): void {
    this.form.markAllAsTouched();
    if (!this.form.valid || this.busy()) return;
    const v = this.form.getRawValue();
    this.apply.emit({
      pagina: 1,
      tamanoPagina: v.tamanoPagina,
      ...(v.estado ? { estado: v.estado } : {}),
      ...(v.reglaAnomaliaId !== null ? { reglaAnomaliaId: v.reglaAnomaliaId } : {}),
      ...(this.auditor && v.areaId !== null ? { areaId: v.areaId } : {}),
      ...(v.usuarioId !== null ? { usuarioId: v.usuarioId } : {}),
      ...(v.fechaDesde ? { fechaDesde: peruQueryDate(v.fechaDesde) } : {}),
      ...(v.fechaHasta ? { fechaHasta: peruQueryDate(v.fechaHasta, true) } : {}),
    });
  }
  protected clear(): void {
    this.form.reset({
      estado: '',
      reglaAnomaliaId: null,
      areaId: null,
      usuarioId: null,
      fechaDesde: '',
      fechaHasta: '',
      tamanoPagina: 20,
    });
    this.submit();
  }
}
