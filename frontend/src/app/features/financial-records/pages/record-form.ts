import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { RecordsApi } from '../data-access/records-api';
import { OperationType } from '../models/requests/record-requests';
import { amountValidator, operationDateValidator } from '../models/financial-decimal';
import { trimmedRequired } from '../../../shared/forms/validators';
import { errorMessage } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { FieldError } from '../../../shared/forms/field-error';

@Component({
  selector: 'app-record-form',
  imports: [RouterLink, ReactiveFormsModule, PageHeader, Feedback, FieldError],
  templateUrl: './record-form.html',
})
export class RecordForm {
  private readonly api = inject(RecordsApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rawId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly id = this.rawId === null ? null : Number(this.rawId);
  private version = '';
  protected readonly loading = signal(this.id !== null);
  protected readonly ready = signal(this.id === null);
  protected readonly busy = signal(false);
  protected readonly conflict = signal(false);
  protected readonly error = signal('');
  protected readonly scope = signal(
    'El área y el usuario responsable se asignan desde su cuenta autenticada.',
  );
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    tipoOperacion: this.fb.control<OperationType>('Ingreso', Validators.required),
    descripcion: ['', [trimmedRequired, Validators.maxLength(250)]],
    fechaOperacion: ['', [Validators.required, operationDateValidator]],
    monto: ['', [Validators.required, amountValidator]],
  });
  constructor() {
    if (this.id !== null) {
      if (!Number.isSafeInteger(this.id) || this.id <= 0) {
        this.loading.set(false);
        this.error.set('El identificador del registro no es válido.');
      } else this.load();
    }
  }
  protected load(): void {
    if (this.id === null || !Number.isSafeInteger(this.id) || this.id <= 0) return;
    this.loading.set(true);
    this.ready.set(false);
    this.error.set('');
    this.api
      .get(this.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (record) => {
          this.version = record.rowVersion;
          this.form.reset({
            tipoOperacion: record.tipoOperacion,
            descripcion: record.descripcion,
            fechaOperacion: record.fechaOperacion,
            monto: record.monto,
          });
          this.scope.set(
            `Área del registro: ${record.nombreArea}. Solo puede modificar registros de su propia área activa.`,
          );
          this.conflict.set(false);
          this.ready.set(true);
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected submit(): void {
    if (this.busy() || !this.ready() || this.conflict()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    this.busy.set(true);
    const operation =
      this.id === null
        ? this.api.create(this.form.getRawValue())
        : this.api.update(this.id, this.form.getRawValue(), this.version);
    operation
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (response) => {
          void this.router.navigate(['/registros', response.registroId]);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 409) this.conflict.set(true);
          this.error.set(errorMessage(error));
        },
      });
  }
}
