import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, describe, expect, it } from 'vitest';
import { QueryState } from './query-state';

describe('Read-only query state', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('cancels old requests and does not replace newer results with stale responses', () => {
    const first = new Subject<string>();
    const second = new Subject<string>();
    const state = TestBed.runInInjectionContext(
      () => new QueryState<number, string>((id) => (id === 1 ? first : second)),
    );
    state.load(1);
    state.load(2);
    expect(first.observed).toBe(false);
    first.next('obsolete');
    second.next('current');
    second.complete();
    expect(state.result()).toBe('current');
    expect(state.loading()).toBe(false);
  });
  it('clears selected data on a forbidden response or closing detail', () => {
    const response = new Subject<string>();
    const state = TestBed.runInInjectionContext(
      () => new QueryState<number, string>(() => response),
    );
    state.load(1);
    response.error(new HttpErrorResponse({ status: 403 }));
    expect(state.result()).toBeNull();
    expect(state.error()).toContain('permiso');
    state.clear();
    expect(state.error()).toBe('');
  });
});
