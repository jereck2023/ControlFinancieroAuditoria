import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable, Subscription } from 'rxjs';
import { errorMessage } from '../../core/http/api-error';

/** Read-only HTTP state shared by lists/details. New requests cancel stale responses. */
export class QueryState<Query, Result> {
  private readonly destroyRef = inject(DestroyRef);
  private subscription?: Subscription;
  private readonly resultState = signal<Result | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  readonly result = this.resultState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  constructor(private readonly fetch: (query: Query) => Observable<Result>) {}
  load(query: Query): void {
    this.clear();
    this.loadingState.set(true);
    this.subscription = this.fetch(query)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (result) => this.resultState.set(result),
        error: (error: unknown) => this.errorState.set(errorMessage(error)),
      });
  }
  clear(): void {
    this.subscription?.unsubscribe();
    this.resultState.set(null);
    this.errorState.set('');
    this.loadingState.set(false);
  }
}
