import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ImportApi } from '../data-access/import-api';
import { ImportPreviewView, validateImportFile } from '../models/import-preview-view';
import { ConfirmImportResponse } from '../models/responses/import-responses';
import { FinancialAmount } from '../../financial-records/components/amount';
import { errorMessage } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { Pagination } from '../../../shared/ui/pagination';
import { ConfirmationDialog } from '../../../shared/ui/confirmation-dialog';

@Component({
  selector: 'app-import-page',
  imports: [
    RouterLink,
    DatePipe,
    FinancialAmount,
    PageHeader,
    Feedback,
    Pagination,
    ConfirmationDialog,
  ],
  templateUrl: './import-page.html',
})
export class ImportPage {
  private readonly api = inject(ImportApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<ImportPreviewView | null>(null);
  protected readonly completed = signal<ConfirmImportResponse | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  protected readonly page = signal(1);
  protected readonly errorPage = signal(1);
  protected readonly visible = computed(
    () => this.preview()?.registros.slice((this.page() - 1) * 10, this.page() * 10) ?? [],
  );
  protected readonly visibleErrors = computed(
    () => this.preview()?.errores.slice((this.errorPage() - 1) * 10, this.errorPage() * 10) ?? [],
  );
  protected readonly canConfirm = computed(
    () =>
      !!this.file() &&
      !!this.preview()?.esValido &&
      !!this.preview()?.hashArchivo &&
      this.preview()?.errores.length === 0 &&
      (this.preview()?.registros.length ?? 0) > 0 &&
      !this.completed(),
  );
  protected selectFile(event: Event): void {
    if (!(event.target instanceof HTMLInputElement) || this.busy()) return;
    this.preview.set(null);
    this.completed.set(null);
    this.error.set('');
    this.page.set(1);
    this.errorPage.set(1);
    const file = event.target.files?.item(0) ?? null;
    if (!file) {
      this.file.set(null);
      return;
    }
    const error = validateImportFile(file);
    if (error) {
      this.file.set(null);
      this.error.set(error);
      event.target.value = '';
      return;
    }
    this.file.set(file);
  }
  protected validate(): void {
    const file = this.file();
    if (!file || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.preview.set(null);
    this.page.set(1);
    this.errorPage.set(1);
    this.api
      .preview({ archivo: file })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (preview) => this.preview.set(preview),
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
  protected confirm(): void {
    const file = this.file();
    const preview = this.preview();
    if (!file || !preview || !this.canConfirm() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .confirm({ archivo: file, hashArchivo: preview.hashArchivo })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.completed.set(result);
          this.file.set(null);
          this.preview.set(null);
          this.fileInput().nativeElement.value = '';
          this.confirming.set(false);
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          this.error.set(errorMessage(error));
        },
      });
  }
}
