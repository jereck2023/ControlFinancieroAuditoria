import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize } from 'rxjs';
import { RecordsApi } from '../data-access/records-api';
import { RecordView } from '../models/record-view';
import { RecordsTable } from '../components/records-table';
import { AccessPolicy } from '../../../core/auth/access-policy';
import { errorMessage } from '../../../core/http/api-error';
import { decodeDownloadError, downloadXlsx } from '../../../core/http/file-download';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';

@Component({
  selector: 'app-records-list',
  imports: [RouterLink, RecordsTable, PageHeader, Feedback],
  templateUrl: './records-list.html',
})
export class RecordsList {
  private readonly api = inject(RecordsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly policy = inject(AccessPolicy);
  protected readonly records = signal<RecordView[]>([]);
  protected readonly loading = signal(false);
  protected readonly downloading = signal(false);
  protected readonly error = signal('');
  protected readonly downloadError = signal('');
  protected readonly recordId = signal<number | undefined>(undefined);
  constructor() {
    this.load();
  }
  protected load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.records.set([]);
    this.api
      .list({ registroFinancieroId: this.recordId() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (records) => this.records.set(records),
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected searchId(id: number | undefined): void {
    if (this.loading()) return;
    this.recordId.set(id);
    this.load();
  }
  protected export(): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.downloadError.set('');
    this.api
      .exportAll()
      .pipe(
        catchError(decodeDownloadError),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.downloading.set(false)),
      )
      .subscribe({
        next: (response) => {
          try {
            downloadXlsx(response, 'CFA_Registros.xlsx');
          } catch (error: unknown) {
            this.downloadError.set(errorMessage(error));
          }
        },
        error: (error: unknown) => this.downloadError.set(errorMessage(error)),
      });
  }
}
