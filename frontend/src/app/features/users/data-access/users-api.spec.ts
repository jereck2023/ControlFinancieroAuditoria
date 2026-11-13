import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { UsersApi } from './users-api';
import { AreasApi } from '../../areas/data-access/areas-api';
import { AuthApi } from '../../auth/data-access/auth-api';

describe('Real API route contracts (HTTP mocked, no database)', () => {
  let testing: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    testing = TestBed.inject(HttpTestingController);
  });
  afterEach(() => testing.verify());
  it('creates users using nombreUsuario, passwordInicial and multiple roles', () => {
    const body = {
      nombreUsuario: 'cuenta',
      nombreCompleto: 'Cuenta institucional',
      passwordInicial: 'Temporal1234!',
      areaId: 2,
      roles: ['Administrador', 'Auditor'] as ('Administrador' | 'Auditor')[],
    };
    TestBed.inject(UsersApi).create(body).subscribe();
    const request = testing.expectOne('/api/usuarios');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({});
  });
  it('uses PUT for user activation and roles, without inventing delete', () => {
    const api = TestBed.inject(UsersApi);
    api.setActive(7, false).subscribe();
    const state = testing.expectOne('/api/usuarios/7/desactivar');
    expect(state.request.method).toBe('PUT');
    state.flush({});
    api.updateRoles(7, { roles: ['JefeArea', 'PersonalArea'] }).subscribe();
    const roles = testing.expectOne('/api/usuarios/7/roles');
    expect(roles.request.method).toBe('PUT');
    expect(roles.request.body).toEqual({ roles: ['JefeArea', 'PersonalArea'] });
    roles.flush({});
  });
  it('uses PATCH for area state and the list endpoint for area lookup', () => {
    const api = TestBed.inject(AreasApi);
    api.list().subscribe();
    testing.expectOne('/api/areas').flush([]);
    api.setActive(3, true).subscribe();
    const request = testing.expectOne('/api/areas/3/activar');
    expect(request.request.method).toBe('PATCH');
    request.flush({});
  });
  it('keeps self-service password change separate from administrative reset', () => {
    TestBed.inject(AuthApi)
      .changePassword({ passwordActual: 'Current1234!', passwordNueva: 'NewPassword1!' })
      .subscribe();
    const change = testing.expectOne('/api/auth/cambiar-password');
    expect(change.request.method).toBe('POST');
    change.flush({});
    TestBed.inject(UsersApi).resetPassword(7, { passwordNueva: 'NewPassword1!' }).subscribe();
    const reset = testing.expectOne('/api/usuarios/7/restablecer-password');
    expect(reset.request.method).toBe('PUT');
    expect(reset.request.body).toEqual({ passwordNueva: 'NewPassword1!' });
    reset.flush({});
  });
});
