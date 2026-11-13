import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin } from 'rxjs';
import { DocumentsApi } from '../data-access/documents-api';
import { DocumentDetailResponse } from '../models/responses/document-response';
import { RecordsTable } from '../../financial-records/components/records-table';
import { RecordView } from '../../financial-records/models/record-view';
import { errorMessage } from '../../../core/http/api-error';
import { decodeDownloadError, downloadXlsx } from '../../../core/http/file-download';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';

@Component({
  selector: 'app-document-detail',
  imports: [RouterLink, DatePipe, RecordsTable, PageHeader, Feedback],
  templateUrl: './document-detail.html',
})
export class DocumentDetail {
  private readonly api = inject(DocumentsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly document = signal<DocumentDetailResponse | null>(null);
  protected readonly records = signal<RecordView[]>([]);
  protected readonly loading = signal(false);
  protected readonly downloading = signal(false);
  protected readonly error = signal('');
  protected readonly downloadError = signal('');
  constructor() {
    this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.document.set(null);
    this.records.set([]);
    forkJoin({ document: this.api.get(this.id), records: this.api.records(this.id) })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.document.set(result.document);
          this.records.set(result.records);
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected export(): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.downloadError.set('');
    this.api
      .export(this.id)
      .pipe(
        catchError(decodeDownloadError),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.downloading.set(false)),
      )
      .subscribe({
        next: (response) => {
          try {
            downloadXlsx(response, `CFA_Documento_${this.id}.xlsx`);
          } catch (error: unknown) {
            this.downloadError.set(errorMessage(error));
          }
        },
        error: (error: unknown) => this.downloadError.set(errorMessage(error)),
      });
  }
}
