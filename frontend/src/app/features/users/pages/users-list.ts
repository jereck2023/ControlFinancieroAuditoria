import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { UsersApi } from '../data-access/users-api';
import { AreasApi } from '../../areas/data-access/areas-api';
import { AreaResponse } from '../../areas/models/responses/area-response';
import { UserResponse } from '../models/responses/user-response';
import { Session } from '../../../core/auth/session';
import { ROLE_LABELS } from '../../../core/auth/roles';
import { errorMessage } from '../../../core/http/api-error';
import { Feedback } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/page-header';
import { Pagination } from '../../../shared/ui/pagination';
import { ConfirmationDialog } from '../../../shared/ui/confirmation-dialog';

@Component({
  selector: 'app-users-list',
  imports: [RouterLink, Feedback, PageHeader, Pagination, ConfirmationDialog],
  templateUrl: './users-list.html',
})
export class UsersList {
  private readonly api = inject(UsersApi);
  private readonly areasApi = inject(AreasApi);
  private readonly session = inject(Session);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly labels = ROLE_LABELS;
  protected readonly users = signal<UserResponse[]>([]);
  protected readonly areas = signal<AreaResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly search = signal('');
  protected readonly state = signal('all');
  protected readonly area = signal('all');
  protected readonly page = signal(1);
  protected readonly selected = signal<UserResponse | null>(null);
  protected readonly saving = signal(false);
  protected readonly actionError = signal('');
  protected readonly filtered = computed(() =>
    this.users().filter(
      (user) =>
        `${user.userName} ${user.nombreCompleto}`
          .toLocaleLowerCase('es')
          .includes(this.search().trim().toLocaleLowerCase('es')) &&
        (this.state() === 'all' || user.activo === (this.state() === 'active')) &&
        (this.area() === 'all' || String(user.areaId) === this.area()),
    ),
  );
  protected readonly visible = computed(() =>
    this.filtered().slice((this.page() - 1) * 10, this.page() * 10),
  );
  constructor() {
    this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.users.set([]);
    this.page.set(1);
    forkJoin({ users: this.api.list(), areas: this.areasApi.list() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.users.set(result.users);
          this.areas.set(result.areas);
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected filter(search: string, state: string, area: string): void {
    this.search.set(search);
    this.state.set(state);
    this.area.set(area);
    this.page.set(1);
  }
  protected select(user: UserResponse): void {
    this.actionError.set('');
    this.selected.set(user);
  }
  protected isLastAdmin(user: UserResponse): boolean {
    return (
      user.activo &&
      user.roles.includes('Administrador') &&
      this.users().filter((item) => item.activo && item.roles.includes('Administrador')).length ===
        1
    );
  }
  protected changeState(): void {
    const user = this.selected();
    if (!user || this.saving()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.success.set('');
    this.api
      .setActive(user.id, !user.activo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (response) => {
          if (user.id === this.session.identity()?.userId) {
            this.session.end('access-changed');
            return;
          }
          this.selected.set(null);
          this.success.set(response.mensaje);
          this.load();
        },
        error: (error: unknown) => this.actionError.set(errorMessage(error)),
      });
  }
}
