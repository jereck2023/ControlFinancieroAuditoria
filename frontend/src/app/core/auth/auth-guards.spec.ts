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
  it.each([['Auditor'], ['Administrador', 'Auditor'], ['JefeArea', 'Auditor']])(
    'bloquea la pantalla manual y mantiene alertas para %j',
    (...roles) => {
      const state = TestBed.inject(Router).routerState.snapshot;
      TestBed.inject(Session).start(
        testToken({ 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': roles }),
      );
      expect(
        TestBed.runInInjectionContext(() => permissionGuard('detect-anomalies')(route, state)),
      ).toEqual(TestBed.inject(Router).parseUrl('/acceso-denegado'));
      expect(
        TestBed.runInInjectionContext(() => permissionGuard('read-alerts')(route, state)),
      ).toBe(true);
    },
  );
  it.each(['PersonalArea', 'JefeArea'])('impide abrir el directorio de áreas al rol %s', (role) => {
    const state = TestBed.inject(Router).routerState.snapshot;
    TestBed.inject(Session).start(
      testToken({
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
      }),
    );
    const result = TestBed.runInInjectionContext(() => permissionGuard('read-areas')(route, state));
    expect(result).toEqual(TestBed.inject(Router).parseUrl('/acceso-denegado'));
  });
  it('permite consulta propia pero no administración a JefeArea + Auditor', () => {
    const state = TestBed.inject(Router).routerState.snapshot;
    TestBed.inject(Session).start(
      testToken({
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': ['JefeArea', 'Auditor'],
      }),
    );
    expect(
      TestBed.runInInjectionContext(() => permissionGuard('read-area-users')(route, state)),
    ).toBe(true);
    expect(TestBed.runInInjectionContext(() => permissionGuard('read-areas')(route, state))).toBe(
      true,
    );
    expect(
      TestBed.runInInjectionContext(() => permissionGuard('manage-users')(route, state)),
    ).toEqual(TestBed.inject(Router).parseUrl('/acceso-denegado'));
  });
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
