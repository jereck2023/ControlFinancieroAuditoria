import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthApi } from '../data-access/auth-api';
import { Session } from '../../../core/auth/session';
import { errorMessage } from '../../../core/http/api-error';
import { matchingPasswords, passwordPolicy } from '../../../shared/forms/validators';
import { FieldError } from '../../../shared/forms/field-error';
import { Feedback } from '../../../shared/ui/feedback';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, FieldError, Feedback],
  templateUrl: './change-password.html',
})
export class ChangePassword {
  protected readonly session = inject(Session);
  private readonly api = inject(AuthApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      passwordActual: ['', Validators.required],
      passwordNueva: ['', passwordPolicy],
      confirmacion: ['', Validators.required],
    },
    { validators: matchingPasswords },
  );
  protected submit(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    const { passwordActual, passwordNueva } = this.form.getRawValue();
    this.api
      .changePassword({ passwordActual, passwordNueva })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.form.reset();
          this.session.end('password-changed');
        },
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          this.form.reset();
        },
      });
  }
}
