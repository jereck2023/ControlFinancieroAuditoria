import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthApi } from '../data-access/auth-api';
import { Session, SessionEnd } from '../../../core/auth/session';
import { errorMessage } from '../../../core/http/api-error';
import { trimmedRequired } from '../../../shared/forms/validators';
import { FieldError } from '../../../shared/forms/field-error';
import { Feedback } from '../../../shared/ui/feedback';

const REASONS: Record<SessionEnd, string> = {
  logout: 'Ha cerrado su sesión en este navegador.',
  expired: 'Su sesión ha vencido. Ingrese nuevamente sus credenciales.',
  unauthorized: 'La sesión dejó de ser válida. Ingrese nuevamente.',
  'password-changed': 'Contraseña actualizada. Inicie sesión con su nueva contraseña.',
  'access-changed': 'Sus datos de acceso cambiaron. Inicie sesión nuevamente.',
};

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, FieldError, Feedback],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly api = inject(AuthApi);
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly visible = signal(false);
  protected readonly notice = computed(() => {
    const reason = this.session.endReason();
    return reason ? REASONS[reason] : '';
  });
  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', trimmedRequired],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    this.busy.set(true);
    this.api
      .login({
        username: this.form.controls.username.value.trim(),
        password: this.form.controls.password.value,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.busy.set(false);
          this.form.controls.password.reset();
        }),
      )
      .subscribe({
        next: (response) => {
          try {
            this.session.start(response.token);
            void this.router.navigateByUrl(
              this.session.identity()?.mustChangePassword ? '/cambiar-password' : '/inicio',
              { replaceUrl: true },
            );
          } catch (error: unknown) {
            this.error.set(errorMessage(error));
          }
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
}
