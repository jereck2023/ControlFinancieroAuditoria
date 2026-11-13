import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { UsersApi } from '../data-access/users-api';
import { UserResponse } from '../models/responses/user-response';
import { Session } from '../../../core/auth/session';
import { errorMessage } from '../../../core/http/api-error';
import { passwordPolicy, matchingPasswords } from '../../../shared/forms/validators';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { FieldError } from '../../../shared/forms/field-error';
import { ConfirmationDialog } from '../../../shared/ui/confirmation-dialog';

@Component({
  selector: 'app-user-password',
  imports: [RouterLink, ReactiveFormsModule, PageHeader, Feedback, FieldError, ConfirmationDialog],
  templateUrl: './user-password.html',
})
export class UserPassword {
  private readonly api = inject(UsersApi);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly user = signal<UserResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group(
    { passwordNueva: ['', passwordPolicy], confirmacion: ['', Validators.required] },
    { validators: matchingPasswords },
  );
  constructor() {
    this.load();
  }
  protected load(): void {
    this.error.set('');
    this.loading.set(true);
    this.api
      .get(this.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (user) => this.user.set(user),
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected confirm(): void {
    if (this.busy() || !this.user()?.activo) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    this.confirming.set(true);
  }
  protected save(): void {
    if (this.busy() || !this.user()?.activo || this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .resetPassword(this.id, { passwordNueva: this.form.controls.passwordNueva.value })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.busy.set(false);
          this.form.reset();
        }),
      )
      .subscribe({
        next: () => {
          if (this.id === this.session.identity()?.userId) this.session.end('access-changed');
          else void this.router.navigateByUrl('/usuarios');
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          this.error.set(errorMessage(error));
        },
      });
  }
}
