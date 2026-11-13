import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ReportsApi } from '../data-access/reports-api';
import { ReportSelection } from '../models/requests/report-query';
import { ReportResult } from '../models/report-view';
import { QueryState } from '../../../shared/http/query-state';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { Pagination } from '../../../shared/ui/pagination';
import { ReportFilters } from '../components/report-filters';
import { ReportTotals } from '../components/report-totals';
import { ReportGroups } from '../components/report-groups';
import { ReportMovements } from '../components/report-movements';
import { decodeDownloadError, downloadXlsx } from '../../../core/http/file-download';
import { errorMessage } from '../../../core/http/api-error';
@Component({
  selector: 'app-reports-page',
  imports: [
    PageHeader,
    Feedback,
    Pagination,
    DatePipe,
    ReportFilters,
    ReportTotals,
    ReportGroups,
    ReportMovements,
  ],
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  private readonly api = inject(ReportsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = new QueryState<ReportSelection, ReportResult>((selection) =>
    this.api.generate(selection),
  );
  protected readonly applied = signal<ReportSelection | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal('');
  protected generate(selection: ReportSelection): void {
    if (this.downloading()) return;
    this.downloadError.set('');
    this.applied.set(selection);
    this.state.load(selection);
  }
  protected page(pagina: number): void {
    const applied = this.applied();
    const result = this.state.result();
    if (
      !applied ||
      !result ||
      this.downloading() ||
      pagina < 1 ||
      pagina > result.data.totalPaginas
    )
      return;
    this.generate({ ...applied, query: { ...applied.query, pagina } });
  }
  protected export(): void {
    const applied = this.applied();
    if (!applied || !this.state.result() || this.downloading() || this.state.loading()) return;
    this.downloading.set(true);
    this.downloadError.set('');
    this.api
      .export(applied)
      .pipe(
        catchError(decodeDownloadError),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.downloading.set(false)),
      )
      .subscribe({
        next: (response) => {
          try {
            downloadXlsx(response, `CFA_${applied.kind}.xlsx`);
          } catch (error: unknown) {
            this.downloadError.set(errorMessage(error));
          }
        },
        error: (error: unknown) => this.downloadError.set(errorMessage(error)),
      });
  }
}
