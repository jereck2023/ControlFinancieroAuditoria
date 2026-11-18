import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { UsersApi } from '../data-access/users-api';
import { AreaUserResponse } from '../models/responses/area-user-response';
import { ROLE_LABELS } from '../../../core/auth/roles';
import { errorMessage } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { Pagination } from '../../../shared/ui/pagination';

@Component({
  selector: 'app-area-users',
  imports: [PageHeader, Feedback, Pagination],
  templateUrl: './area-users.html',
})
export class AreaUsers {
  private readonly api = inject(UsersApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly labels = ROLE_LABELS;
  protected readonly users = signal<AreaUserResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly state = signal('all');
  protected readonly page = signal(1);
  protected readonly filtered = computed(() =>
    this.users().filter(
      (user) =>
        `${user.userName} ${user.nombreCompleto}`
          .toLocaleLowerCase('es')
          .includes(this.search().trim().toLocaleLowerCase('es')) &&
        (this.state() === 'all' || user.activo === (this.state() === 'active')),
    ),
  );
  protected readonly visible = computed(() =>
    this.filtered().slice((this.page() - 1) * 10, this.page() * 10),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    if (this.loading()) return;
    this.users.set([]);
    this.error.set('');
    this.page.set(1);
    this.loading.set(true);
    this.api
      .listMyArea()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (users) => this.users.set(users),
        error: (error: unknown) =>
          this.error.set(
            error instanceof HttpErrorResponse && error.status === 0
              ? 'No se pudo conectar con el sistema. Compruebe la conexión y vuelva a intentar.'
              : errorMessage(error),
          ),
      });
  }

  protected filter(search: string, state: string): void {
    this.search.set(search);
    this.state.set(state);
    this.page.set(1);
  }
}
