import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize } from 'rxjs';
import { DocumentsApi } from '../data-access/documents-api';
import { DocumentResponse } from '../models/responses/document-response';
import { AccessPolicy } from '../../../core/auth/access-policy';
import { errorMessage } from '../../../core/http/api-error';
import { decodeDownloadError, downloadXlsx } from '../../../core/http/file-download';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { Pagination } from '../../../shared/ui/pagination';

@Component({
  selector: 'app-documents-list',
  imports: [RouterLink, DatePipe, PageHeader, Feedback, Pagination],
  templateUrl: './documents-list.html',
})
export class DocumentsList {
  private readonly api = inject(DocumentsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly policy = inject(AccessPolicy);
  protected readonly documents = signal<DocumentResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly downloading = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly downloadError = signal('');
  protected readonly search = signal('');
  protected readonly area = signal('');
  protected readonly page = signal(1);
  protected readonly areas = computed(() => [
    ...new Map(
      this.documents().map((document) => [document.areaId, document.nombreArea]),
    ).entries(),
  ]);
  protected readonly filtered = computed(() =>
    this.documents().filter(
      (document) =>
        document.nombreArchivo
          .toLocaleLowerCase('es')
          .includes(this.search().trim().toLocaleLowerCase('es')) &&
        (!this.area() || String(document.areaId) === this.area()),
    ),
  );
  protected readonly visible = computed(() =>
    this.filtered().slice((this.page() - 1) * 10, this.page() * 10),
  );
  constructor() {
    this.load();
  }
  protected filter(search: string, area: string): void {
    this.search.set(search);
    this.area.set(area);
    this.page.set(1);
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.documents.set([]);
    this.page.set(1);
    this.api
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (documents) => this.documents.set(documents),
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected export(id: number): void {
    if (this.downloading() !== null) return;
    this.downloading.set(id);
    this.downloadError.set('');
    this.api
      .export(id)
      .pipe(
        catchError(decodeDownloadError),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.downloading.set(null)),
      )
      .subscribe({
        next: (response) => {
          try {
            downloadXlsx(response, `CFA_Documento_${id}.xlsx`);
          } catch (error: unknown) {
            this.downloadError.set(errorMessage(error));
          }
        },
        error: (error: unknown) => this.downloadError.set(errorMessage(error)),
      });
  }
}
