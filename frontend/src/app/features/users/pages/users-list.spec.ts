import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UsersList } from './users-list';
import { Session } from '../../../core/auth/session';
import { testToken } from '../../../core/auth/testing/jwt-fixture';
import { UserResponse } from '../models/responses/user-response';

describe('Last active administrator UI protection (simulated HTTP)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [UsersList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(Session).start(testToken());
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });
  const admin: UserResponse = {
    id: 7,
    userName: 'qa.admin',
    nombreCompleto: 'Administrador de prueba',
    areaId: null,
    nombreArea: null,
    activo: true,
    debeCambiarPassword: false,
    roles: ['Administrador'],
  };
  async function setup(users: UserResponse[]) {
    const fixture = TestBed.createComponent(UsersList);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/usuarios').flush(users);
    http.expectOne('/api/areas').flush([]);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }
  it('prevents disabling the sole active admin even if another admin is inactive', async () => {
    const element = await setup([
      admin,
      { ...admin, id: 8, userName: 'qa.inactivo', activo: false },
    ]);
    const button = element.querySelector<HTMLButtonElement>('[aria-label="Desactivar qa.admin"]');
    expect(button?.disabled).toBe(true);
    expect(button?.title).toContain('último administrador activo');
  });
  it('allows the action when another active admin exists, including combined roles', async () => {
    const element = await setup([
      admin,
      { ...admin, id: 8, userName: 'qa.combinado', areaId: 2, roles: ['Administrador', 'Auditor'] },
    ]);
    expect(
      element.querySelector<HTMLButtonElement>('[aria-label="Desactivar qa.admin"]')?.disabled,
    ).toBe(false);
  });
});
