import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AreasApi } from '../data-access/areas-api';
import { AreaResponse } from '../models/responses/area-response';
import { AccessPolicy } from '../../../core/auth/access-policy';
import { errorMessage } from '../../../core/http/api-error';
import { Feedback } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/page-header';
import { Pagination } from '../../../shared/ui/pagination';
import { ConfirmationDialog } from '../../../shared/ui/confirmation-dialog';

@Component({
  selector: 'app-areas-list',
  imports: [RouterLink, Feedback, PageHeader, Pagination, ConfirmationDialog],
  templateUrl: './areas-list.html',
})
export class AreasList {
  private readonly api = inject(AreasApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly policy = inject(AccessPolicy);
  protected readonly areas = signal<AreaResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly search = signal('');
  protected readonly state = signal('all');
  protected readonly page = signal(1);
  protected readonly selected = signal<AreaResponse | null>(null);
  protected readonly saving = signal(false);
  protected readonly actionError = signal('');
  protected readonly activeCount = computed(
    () => this.areas().filter((area) => area.activo).length,
  );
  protected readonly filtered = computed(() =>
    this.areas().filter(
      (area) =>
        area.nombre
          .toLocaleLowerCase('es')
          .includes(this.search().trim().toLocaleLowerCase('es')) &&
        (this.state() === 'all' || area.activo === (this.state() === 'active')),
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
    this.areas.set([]);
    this.page.set(1);
    this.api
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (areas) => this.areas.set(areas),
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected filter(search: string, state: string): void {
    this.search.set(search);
    this.state.set(state);
    this.page.set(1);
  }
  protected select(area: AreaResponse): void {
    this.actionError.set('');
    this.selected.set(area);
  }
  protected changeState(): void {
    const area = this.selected();
    if (!area || this.saving() || !this.policy.can('manage-areas')) return;
    this.saving.set(true);
    this.actionError.set('');
    this.success.set('');
    this.api
      .setActive(area.areaId, !area.activo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.selected.set(null);
          this.success.set('Estado del área actualizado.');
          this.load();
        },
        error: (error: unknown) => this.actionError.set(errorMessage(error)),
      });
  }
}
