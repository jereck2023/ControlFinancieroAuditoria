import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AreasApi } from '../data-access/areas-api';
import { errorMessage } from '../../../core/http/api-error';
import { trimmedRequired } from '../../../shared/forms/validators';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { FieldError } from '../../../shared/forms/field-error';

@Component({
  selector: 'app-area-form',
  imports: [RouterLink, ReactiveFormsModule, PageHeader, Feedback, FieldError],
  templateUrl: './area-form.html',
})
export class AreaForm {
  private readonly api = inject(AreasApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || null;
  protected readonly loading = signal(!!this.id);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly ready = signal(!this.id);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [trimmedRequired, Validators.maxLength(100)]],
  });
  constructor() {
    if (this.id) this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.ready.set(false);
    // There is no GET /areas/{id}: read the actual supported list endpoint.
    this.api
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (areas) => {
          const area = areas.find((item) => item.areaId === this.id);
          if (area) {
            this.form.patchValue({ nombre: area.nombre });
            this.ready.set(true);
          } else this.error.set('El área solicitada no existe.');
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected submit(): void {
    if (this.busy() || !this.ready()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    const request = { nombre: this.form.controls.nombre.value.trim() };
    const operation = this.id ? this.api.update(this.id, request) : this.api.create(request);
    operation
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/areas');
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
}
