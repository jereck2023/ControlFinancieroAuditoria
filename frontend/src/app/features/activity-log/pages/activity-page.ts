import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivityApi } from '../data-access/activity-api';
import { ActivityQuery, activityQuery } from '../models/requests/activity-query';
import {
  ActivityDetailResponse,
  ActivityPageResponse,
} from '../models/responses/activity-responses';
import { QueryState } from '../../../shared/http/query-state';
import { TraceFilters } from '../../../shared/traceability/trace-filters';
import { TraceFiltersValue } from '../../../shared/traceability/trace-query';
import { UtcTimestamp } from '../../../shared/traceability/utc-timestamp';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { Pagination } from '../../../shared/ui/pagination';

@Component({
  selector: 'app-activity-page',
  imports: [RouterLink, TraceFilters, UtcTimestamp, PageHeader, Feedback, Pagination],
  templateUrl: './activity-page.html',
  styles: `
    .activity-description {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class ActivityPage {
  private readonly api = inject(ActivityApi);
  protected readonly list = new QueryState<ActivityQuery, ActivityPageResponse>((query) =>
    this.api.list(query),
  );
  protected readonly detail = new QueryState<number, ActivityDetailResponse>((id) =>
    this.api.detail(id),
  );
  protected readonly selected = signal<number | null>(null);
  protected readonly query = signal<ActivityQuery>({ pagina: 1, tamanoPagina: 20 });
  constructor() {
    this.load();
  }
  protected load(): void {
    this.closeDetail();
    this.list.load(this.query());
  }
  protected filter(value: TraceFiltersValue): void {
    this.query.set(activityQuery(value));
    this.load();
  }
  protected page(pagina: number): void {
    const result = this.list.result();
    if (!result || pagina < 1 || pagina > result.totalPaginas) return;
    this.query.update((query) => ({ ...query, pagina }));
    this.load();
  }
  protected show(id: number): void {
    this.selected.set(id);
    this.detail.load(id);
  }
  protected closeDetail(): void {
    this.detail.clear();
    this.selected.set(null);
  }
}
