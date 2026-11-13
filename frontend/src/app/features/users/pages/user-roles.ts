import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { UsersApi } from '../data-access/users-api';
import { UserResponse } from '../models/responses/user-response';
import { Role } from '../../../core/auth/roles';
import { Session } from '../../../core/auth/session';
import { errorMessage } from '../../../core/http/api-error';
import { requiresArea } from '../models/user-validation';
import { RolePicker } from '../components/role-picker';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { ConfirmationDialog } from '../../../shared/ui/confirmation-dialog';

@Component({
  selector: 'app-user-roles',
  imports: [RouterLink, PageHeader, Feedback, RolePicker, ConfirmationDialog],
  templateUrl: './user-roles.html',
})
export class UserRoles {
  private readonly api = inject(UsersApi);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly user = signal<UserResponse | null>(null);
  protected readonly selected = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  protected readonly error = signal('');
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
        next: (user) => {
          this.user.set(user);
          this.selected.set([...user.roles]);
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected confirm(): void {
    this.error.set('');
    const user = this.user();
    if (!user || this.busy()) return;
    if (!this.selected().length) {
      this.error.set('Seleccione al menos un rol.');
      return;
    }
    if (requiresArea(this.selected()) && user.areaId === null) {
      this.error.set('Asigne un área institucional antes de establecer estos roles.');
      return;
    }
    this.confirming.set(true);
  }
  protected save(): void {
    const user = this.user();
    if (!user || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const changed =
      user.roles.length !== this.selected().length ||
      user.roles.some((role) => !this.selected().includes(role));
    this.api
      .updateRoles(this.id, { roles: this.selected() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          if (changed && this.id === this.session.identity()?.userId)
            this.session.end('access-changed');
          else void this.router.navigateByUrl('/usuarios');
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
}
