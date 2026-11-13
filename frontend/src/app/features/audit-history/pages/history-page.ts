import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HistoryApi } from '../data-access/history-api';
import { HistoryQuery, historyQuery } from '../models/requests/history-query';
import { HistoryPageResponse } from '../models/responses/history-responses';
import { HistoryDetailView } from '../models/history-detail-view';
import { HistoryChanges } from '../components/history-changes';
import { QueryState } from '../../../shared/http/query-state';
import { TraceFilters } from '../../../shared/traceability/trace-filters';
import { TraceFiltersValue } from '../../../shared/traceability/trace-query';
import { UtcTimestamp } from '../../../shared/traceability/utc-timestamp';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { Pagination } from '../../../shared/ui/pagination';

@Component({
  selector: 'app-history-page',
  imports: [
    RouterLink,
    HistoryChanges,
    TraceFilters,
    UtcTimestamp,
    PageHeader,
    Feedback,
    Pagination,
  ],
  templateUrl: './history-page.html',
})
export class HistoryPage {
  private readonly api = inject(HistoryApi);
  protected readonly list = new QueryState<HistoryQuery, HistoryPageResponse>((query) =>
    this.api.list(query),
  );
  protected readonly detail = new QueryState<number, HistoryDetailView>((id) =>
    this.api.detail(id),
  );
  protected readonly selected = signal<number | null>(null);
  protected readonly query = signal<HistoryQuery>({ pagina: 1, tamanoPagina: 20 });
  constructor() {
    this.load();
  }
  protected load(): void {
    this.closeDetail();
    this.list.load(this.query());
  }
  protected filter(value: TraceFiltersValue): void {
    this.query.set(historyQuery(value));
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
