import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRouteSnapshot } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Session } from './session';
import { authGuard, completeSessionGuard, permissionGuard } from './auth-guards';
import { testToken } from './testing/jwt-fixture';

describe('Navigation guards', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });
  const route = new ActivatedRouteSnapshot();
  it('requires login for direct navigation without a session', () => {
    const state = TestBed.inject(Router).routerState.snapshot;
    const result = TestBed.runInInjectionContext(() => authGuard(route, state));
    expect(result).toEqual(TestBed.inject(Router).parseUrl('/login'));
  });
  it('blocks protected sections until mandatory password change', () => {
    const state = TestBed.inject(Router).routerState.snapshot;
    TestBed.inject(Session).start(testToken({ DebeCambiarPassword: 'true' }));
    const result = TestBed.runInInjectionContext(() => completeSessionGuard(route, state));
    expect(result).toEqual(TestBed.inject(Router).parseUrl('/cambiar-password'));
  });
  it('prevents Auditor from opening administrative user routes', () => {
    const state = TestBed.inject(Router).routerState.snapshot;
    TestBed.inject(Session).start(
      testToken({ 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Auditor' }),
    );
    const result = TestBed.runInInjectionContext(() =>
      permissionGuard('manage-users')(route, state),
    );
    expect(result).toEqual(TestBed.inject(Router).parseUrl('/acceso-denegado'));
  });
});
