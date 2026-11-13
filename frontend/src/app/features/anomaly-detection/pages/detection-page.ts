import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AnomaliesApi } from '../data-access/anomalies-api';
import { DetectionResponse } from '../models/responses/detection-response';
import { RuleReference } from '../components/rule-reference';
import { DetectionResult } from '../components/detection-result';
import { PageHeader } from '../../../shared/ui/page-header';
import { Feedback } from '../../../shared/ui/feedback';
import { AccessPolicy } from '../../../core/auth/access-policy';
import { errorMessage } from '../../../core/http/api-error';
@Component({
  selector: 'app-detection-page',
  imports: [PageHeader, Feedback, RuleReference, DetectionResult],
  templateUrl: './detection-page.html',
})
export class DetectionPage {
  private readonly api = inject(AnomaliesApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly policy = inject(AccessPolicy);
  protected readonly busy = signal(false);
  protected readonly result = signal<DetectionResponse | null>(null);
  protected readonly error = signal('');
  protected readonly uncertain = signal(false);
  protected detect(): void {
    if (this.busy() || !this.policy.can('detect-anomalies')) return;
    this.result.set(null);
    this.error.set('');
    this.uncertain.set(false);
    this.busy.set(true);
    this.api
      .detect()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          this.uncertain.set(
            !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500,
          );
        },
      });
  }
}
