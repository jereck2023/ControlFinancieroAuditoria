import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AreasApi } from '../../areas/data-access/areas-api';
import { AreaResponse } from '../../areas/models/responses/area-response';
import { errorMessage } from '../../../core/http/api-error';
import { FormBuilder, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { Session } from '../../../core/auth/session';
import { optionalId } from '../../../shared/traceability/trace-query';
import { operationDateValidator } from '../../financial-records/models/financial-decimal';
import { FieldError } from '../../../shared/forms/field-error';
import { ReportGrouping, ReportKind, ReportSelection } from '../models/requests/report-query';

export const reportRange: ValidatorFn = (control) => {
  const from: unknown = control.get('fechaDesde')?.value;
  const until: unknown = control.get('fechaHasta')?.value;
  return typeof from === 'string' && typeof until === 'string' && from && until && from > until
    ? { dateRange: true }
    : null;
};
function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
@Component({
  selector: 'app-report-filters',
  imports: [ReactiveFormsModule, FieldError],
  templateUrl: './report-filters.html',
})
export class ReportFilters {
  readonly busy = input(false);
  readonly apply = output<ReportSelection>();
  private readonly fb = inject(FormBuilder);
  private readonly areasApi = inject(AreasApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly areas = signal<AreaResponse[]>([]);
  protected readonly areasLoading = signal(false);
  protected readonly areasError = signal('');
  protected readonly auditor = inject(Session).identity()?.roles.includes('Auditor') ?? false;
  protected readonly form = this.fb.group(
    {
      kind: this.fb.nonNullable.control<ReportKind>('resumen'),
      fechaDesde: this.fb.nonNullable.control(today().slice(0, 7) + '-01', [
        Validators.required,
        operationDateValidator,
      ]),
      fechaHasta: this.fb.nonNullable.control(today(), [
        Validators.required,
        operationDateValidator,
      ]),
      tipoOperacion: this.fb.nonNullable.control<'' | 'Ingreso' | 'Egreso'>(''),
      areaId: this.fb.control<number | null>(null, optionalId),
      documentMode: this.fb.nonNullable.control<'all' | 'specific' | 'none'>('all'),
      documentoFinancieroId: this.fb.control<number | null>(null, optionalId),
      agrupacion: this.fb.nonNullable.control<ReportGrouping>('Ninguna'),
      tamanoPagina: this.fb.nonNullable.control(20),
    },
    { validators: reportRange },
  );
  constructor() {
    if (this.auditor) this.loadAreas();
  }
  protected loadAreas(): void {
    if (this.areasLoading()) return;
    this.areasLoading.set(true);
    this.areasError.set('');
    this.areasApi
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.areasLoading.set(false)),
      )
      .subscribe({
        next: (areas) => {
          this.areas.set(areas);
          if (
            this.form.controls.areaId.value !== null &&
            !areas.some((area) => area.areaId === this.form.controls.areaId.value)
          )
            this.form.controls.areaId.reset(null);
        },
        error: (error: unknown) => this.areasError.set(errorMessage(error)),
      });
  }
  protected submit(): void {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (
      !this.form.valid ||
      this.busy() ||
      (value.documentMode === 'specific' && value.documentoFinancieroId === null)
    )
      return;
    if (
      this.auditor &&
      value.areaId !== null &&
      !this.areas().some((area) => area.areaId === value.areaId)
    )
      return;
    this.apply.emit({
      kind: value.kind,
      query: {
        fechaDesde: value.fechaDesde,
        fechaHasta: value.fechaHasta,
        ...(value.tipoOperacion ? { tipoOperacion: value.tipoOperacion } : {}),
        ...(this.auditor && value.areaId !== null ? { areaId: value.areaId } : {}),
        ...(value.documentMode === 'specific' && value.documentoFinancieroId !== null
          ? { documentoFinancieroId: value.documentoFinancieroId }
          : {}),
        soloSinDocumento: value.documentMode === 'none',
        agrupacion: value.kind === 'resumen' ? value.agrupacion : 'Ninguna',
        pagina: 1,
        tamanoPagina: value.tamanoPagina,
      },
    });
  }
  protected documentModeChanged(): void {
    this.form.controls.documentoFinancieroId.reset(null);
  }
}
