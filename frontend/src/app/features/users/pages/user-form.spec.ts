import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserForm } from './user-form';
import { Session } from '../../../core/auth/session';
import { testToken } from '../../../core/auth/testing/jwt-fixture';

describe('User administration form', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [UserForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    TestBed.inject(Session).start(testToken());
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  async function setup() {
    const fixture = TestBed.createComponent(UserForm);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/areas')
      .flush([
        { areaId: 2, nombre: 'Tesorería', activo: true },
        { areaId: 3, nombre: 'Inactiva', activo: false },
      ]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [
      ['user-name', 'nueva.cuenta'],
      ['full-name', 'Cuenta institucional'],
      ['initial-password', 'Temporal1234!'],
    ]) {
      const input = element.querySelector<HTMLInputElement>('#' + id);
      if (!input) throw new Error('Missing form field');
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return { fixture, element };
  }

  it('allows an exclusive Administrator without an area and forces initial change through the real create contract', async () => {
    const { fixture, element } = await setup();
    element.querySelector<HTMLInputElement>('app-role-picker input')?.click();
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = TestBed.inject(HttpTestingController).expectOne('/api/usuarios');
    expect(request.request.body).toEqual({
      nombreUsuario: 'nueva.cuenta',
      nombreCompleto: 'Cuenta institucional',
      areaId: null,
      passwordInicial: 'Temporal1234!',
      roles: ['Administrador'],
    });
    request.flush({ mensaje: 'Registrado', usuario: { id: 8 } });
    await fixture.whenStable();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/usuarios');
  });

  it('requires an active area for a role combination before sending the create request', async () => {
    const { fixture, element } = await setup();
    const roles = element.querySelectorAll<HTMLInputElement>('app-role-picker input');
    roles[0].click();
    await fixture.whenStable();
    roles[3].click();
    await fixture.whenStable();
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectNone('/api/usuarios');
    expect(element.textContent).toContain('Debe asignar un área institucional.');
    const select = element.querySelector<HTMLSelectElement>('#assigned-area');
    if (!select) throw new Error('Missing area select');
    expect(select.options[2].disabled).toBe(true);
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = TestBed.inject(HttpTestingController).expectOne('/api/usuarios');
    expect(request.request.body.areaId).toBe(2);
    expect(request.request.body.roles).toEqual(['Administrador', 'Auditor']);
    request.flush({});
  });

  it('keeps the form open and reports a duplicate username returned by the server', async () => {
    const { fixture, element } = await setup();
    element.querySelector<HTMLInputElement>('app-role-picker input')?.click();
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/usuarios')
      .flush(
        { mensaje: 'El nombre de usuario ya está registrado.' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('ya está registrado');
    expect(element.querySelector<HTMLInputElement>('#initial-password')?.value).toBe('');
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
  });
});
