import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { UsersApi } from '../data-access/users-api';
import { AreasApi } from '../../areas/data-access/areas-api';
import { AreaResponse } from '../../areas/models/responses/area-response';
import { UserResponse } from '../models/responses/user-response';
import { Role } from '../../../core/auth/roles';
import { Session } from '../../../core/auth/session';
import { errorMessage } from '../../../core/http/api-error';
import { trimmedRequired, passwordPolicy } from '../../../shared/forms/validators';
import { areaForRoles } from '../models/user-validation';
import { RolePicker } from '../components/role-picker';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { FieldError } from '../../../shared/forms/field-error';

@Component({
  selector: 'app-user-form',
  imports: [RouterLink, ReactiveFormsModule, PageHeader, Feedback, FieldError, RolePicker],
  templateUrl: './user-form.html',
})
export class UserForm {
  private readonly api = inject(UsersApi);
  private readonly areasApi = inject(AreasApi);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || null;
  protected readonly original = signal<UserResponse | null>(null);
  protected readonly roles = signal<Role[]>([]);
  protected readonly areas = signal<AreaResponse[]>([]);
  protected readonly activeAreas = computed(() => this.areas().filter((area) => area.activo));
  protected readonly loading = signal(true);
  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      nombreUsuario: ['', [trimmedRequired, Validators.pattern(/^[a-zA-Z0-9\-._+@]+$/)]],
      nombreCompleto: ['', [trimmedRequired, Validators.maxLength(150)]],
      areaId: [null as number | null],
      passwordInicial: ['', this.id ? [] : [passwordPolicy]],
    },
    { validators: areaForRoles(() => this.roles()) },
  );
  constructor() {
    this.load();
  }
  protected setRoles(roles: Role[]): void {
    this.roles.set(roles);
    this.form.updateValueAndValidity();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.ready.set(false);
    if (this.id) {
      forkJoin({ user: this.api.get(this.id), areas: this.areasApi.list() })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.loading.set(false)),
        )
        .subscribe({
          next: ({ user, areas }) => {
            this.original.set(user);
            this.roles.set(user.roles);
            this.areas.set(areas);
            this.form.patchValue({
              nombreUsuario: user.userName,
              nombreCompleto: user.nombreCompleto,
              areaId: user.areaId,
            });
            this.ready.set(true);
          },
          error: (error: unknown) => this.error.set(errorMessage(error)),
        });
    } else {
      this.areasApi
        .list()
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.loading.set(false)),
        )
        .subscribe({
          next: (areas) => {
            this.areas.set(areas);
            this.ready.set(true);
          },
          error: (error: unknown) => this.error.set(errorMessage(error)),
        });
    }
  }
  protected submit(): void {
    if (this.busy() || !this.ready()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    if (this.form.invalid || this.roles().length === 0) return;
    const values = this.form.getRawValue();
    if (
      values.areaId !== null &&
      !this.activeAreas().some((area) => area.areaId === values.areaId)
    ) {
      this.error.set('Seleccione un área activa antes de guardar.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const request = {
      nombreUsuario: values.nombreUsuario.trim(),
      nombreCompleto: values.nombreCompleto.trim(),
      areaId: values.areaId,
    };
    if (this.id) {
      const original = this.original();
      this.api
        .update(this.id, request)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.busy.set(false)),
        )
        .subscribe({
          next: () => {
            if (
              this.id === this.session.identity()?.userId &&
              (original?.userName !== request.nombreUsuario || original?.areaId !== request.areaId)
            )
              this.session.end('access-changed');
            else void this.router.navigateByUrl('/usuarios');
          },
          error: (error: unknown) => this.error.set(errorMessage(error)),
        });
    } else {
      this.api
        .create({ ...request, passwordInicial: values.passwordInicial, roles: this.roles() })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => {
            this.busy.set(false);
            this.form.controls.passwordInicial.reset();
          }),
        )
        .subscribe({
          next: () => {
            void this.router.navigateByUrl('/usuarios');
          },
          error: (error: unknown) => this.error.set(errorMessage(error)),
        });
    }
  }
}
