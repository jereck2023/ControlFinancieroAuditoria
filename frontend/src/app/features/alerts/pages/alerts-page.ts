import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable, Subscription } from 'rxjs';
import { AlertsApi } from '../data-access/alerts-api';
import { AlertQuery, AlertAction } from '../models/requests/alert-requests';
import { AlertPageResponse, AlertDetailResponse } from '../models/responses/alert-responses';
import { validAlertVersion } from '../models/alert-view';
import { AccessPolicy } from '../../../core/auth/access-policy';
import { errorMessage } from '../../../core/http/api-error';
import { QueryState } from '../../../shared/http/query-state';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { Pagination } from '../../../shared/ui/pagination';
import { UtcTimestamp } from '../../../shared/traceability/utc-timestamp';
import { AlertFilters } from '../components/alert-filters';
import { AlertStatus } from '../components/alert-status';
import { AlertDetail } from '../components/alert-detail';
@Component({
  selector: 'app-alerts-page',
  imports: [PageHeader, Feedback, Pagination, UtcTimestamp, AlertFilters, AlertStatus, AlertDetail],
  templateUrl: './alerts-page.html',
})
export class AlertsPage {
  private readonly api = inject(AlertsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly policy = inject(AccessPolicy);
  private detailRequest?: Subscription;
  protected readonly list = new QueryState<AlertQuery, AlertPageResponse>((query) =>
    this.api.list(query),
  );
  protected readonly query = signal<AlertQuery>({ pagina: 1, tamanoPagina: 20 });
  protected readonly selected = signal<number | null>(null);
  protected readonly detail = signal<AlertDetailResponse | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  protected readonly mutating = signal(false);
  protected readonly stale = signal(false);
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly conflict = signal('');
  constructor() {
    this.list.load(this.query());
    effect(() => {
      const result = this.list.result();
      if (!result || this.mutating()) return;
      const lastPage = Math.max(1, result.totalPaginas);
      if (result.pagina > lastPage) {
        const query = { ...this.query(), pagina: lastPage };
        this.query.set(query);
        this.list.load(query);
      }
    });
  }
  protected filter(query: AlertQuery): void {
    if (this.mutating()) return;
    this.closeDetail();
    this.query.set(query);
    this.list.load(query);
  }
  protected page(pagina: number): void {
    if (
      this.mutating() ||
      !this.list.result() ||
      pagina < 1 ||
      pagina > this.list.result()!.totalPaginas
    )
      return;
    this.filter({ ...this.query(), pagina });
  }
  protected refresh(): void {
    if (this.mutating()) return;
    this.list.load(this.query());
    if (this.selected() !== null) this.loadDetail(this.selected()!, true);
  }
  protected show(id: number): void {
    if (this.mutating()) return;
    this.notice.set('');
    this.conflict.set('');
    this.actionError.set('');
    this.selected.set(id);
    this.loadDetail(id);
  }
  protected closeDetail(): void {
    if (this.mutating()) return;
    this.detailRequest?.unsubscribe();
    this.selected.set(null);
    this.detail.set(null);
    this.detailError.set('');
    this.detailLoading.set(false);
    this.stale.set(false);
    this.notice.set('');
    this.conflict.set('');
    this.actionError.set('');
  }
  protected reloadDetail(): void {
    if (this.selected() !== null && !this.mutating()) this.loadDetail(this.selected()!, true, true);
  }
  protected clearActionFeedback(): void {
    if (!this.mutating()) {
      this.actionError.set('');
      this.conflict.set('');
      this.notice.set('');
    }
  }
  private loadDetail(id: number, preserve = false, acknowledgeRecovery = false): void {
    this.detailRequest?.unsubscribe();
    if (!preserve) this.detail.set(null);
    this.detailError.set('');
    this.detailLoading.set(true);
    this.stale.set(true);
    this.detailRequest = this.api
      .detail(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.detailLoading.set(false)),
      )
      .subscribe({
        next: (item) => {
          if (!validAlertVersion(item.rowVersion)) {
            this.detailError.set(
              'No se pudo verificar la versión actual de la alerta. Actualice el detalle.',
            );
            return;
          }
          this.detail.set(item);
          this.stale.set(false);
          if (acknowledgeRecovery) this.clearActionFeedback();
        },
        error: (error: unknown) => {
          this.detailError.set(errorMessage(error));
          if (error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)) {
            this.detail.set(null);
            this.list.load(this.query());
          }
        },
      });
  }
  protected act(action: AlertAction): void {
    const item = this.detail();
    if (
      !item ||
      this.mutating() ||
      this.stale() ||
      this.detailLoading() ||
      !this.policy.can('manage-alerts') ||
      action.request.rowVersion !== item.rowVersion
    )
      return;
    if (
      (action.kind === 'start' && item.estado !== 'Pendiente') ||
      (action.kind === 'close' && item.estado !== 'En revision')
    )
      return;
    this.mutating.set(true);
    this.actionError.set('');
    this.notice.set('');
    this.conflict.set('');
    const request: Observable<{ mensaje: string }> =
      action.kind === 'start'
        ? this.api.startReview(item.alertaId, action.request)
        : this.api.close(item.alertaId, action.request);
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.notice.set(response.mensaje);
          this.loadDetail(item.alertaId, true);
          this.list.load(this.query());
        },
        error: (error: unknown) => {
          this.actionError.set(errorMessage(error));
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.conflict.set(
              'La alerta cambió. Se solicitaron los datos actuales; revíselos antes de confirmar nuevamente. No se reenvió la operación.',
            );
            this.loadDetail(item.alertaId, true);
            this.list.load(this.query());
          } else if (
            !(error instanceof HttpErrorResponse) ||
            (error.status >= 200 && error.status < 300) ||
            error.status === 0 ||
            error.status >= 500
          ) {
            this.conflict.set(
              'No se pudo confirmar el cambio. Se solicitaron los datos actuales antes de permitir otro intento.',
            );
            this.loadDetail(item.alertaId, true);
            this.list.load(this.query());
          } else if ([401, 403, 404].includes(error.status)) {
            this.stale.set(true);
            this.detail.set(null);
            this.detailError.set(errorMessage(error));
            this.list.load(this.query());
          }
        },
      });
  }
}
