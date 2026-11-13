import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { RecordsApi } from '../data-access/records-api';
import { RecordView } from '../models/record-view';
import { FinancialAmount } from '../components/amount';
import { AccessPolicy } from '../../../core/auth/access-policy';
import { errorMessage } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';

@Component({
  selector: 'app-record-detail',
  imports: [RouterLink, DatePipe, FinancialAmount, PageHeader, Feedback],
  templateUrl: './record-detail.html',
})
export class RecordDetail {
  private readonly api = inject(RecordsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly policy = inject(AccessPolicy);
  protected readonly record = signal<RecordView | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  constructor() {
    this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.record.set(null);
    this.api
      .get(this.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (record) => this.record.set(record),
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
}
