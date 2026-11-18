import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AreaUsers } from './area-users';

describe('Usuarios de mi área (HTTP simulado)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [AreaUsers],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('explica un fallo de conexión sin términos técnicos', async () => {
    const fixture = TestBed.createComponent(AreaUsers);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/usuarios/mi-area')
      .error(new ProgressEvent('error'));
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No se pudo conectar con el sistema.');
    expect(text).not.toMatch(/API|DTO|JSON/);
  });

  it('consulta el alcance del servidor sin catálogo de áreas ni controles administrativos', async () => {
    const fixture = TestBed.createComponent(AreaUsers);
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('/api/usuarios/mi-area');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush([
      {
        id: 2,
        userName: 'qa.usuario',
        nombreCompleto: '<img src=x onerror=alert(1)>',
        activo: false,
        roles: ['PersonalArea', 'JefeArea'],
      },
    ]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('qa.usuario');
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(element.textContent).toContain('Jefe de área');
    expect(element.textContent).toContain('Inactivo');
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('a')).toBeNull();
    expect(element.textContent).not.toMatch(
      /Nuevo usuario|Editar|Contraseña|Desactivar|Asignar roles/,
    );
    http.expectNone('/api/areas');
  });

  it('muestra estado vacío y errores de acceso sin retener datos anteriores', async () => {
    const fixture = TestBed.createComponent(AreaUsers);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/usuarios/mi-area').flush([]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('No se encontraron usuarios');
    element.querySelector('button')!.click();
    http
      .expectOne('/api/usuarios/mi-area')
      .flush(
        { mensaje: 'No tiene un área institucional activa asignada.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await fixture.whenStable();
    expect(element.textContent).toContain('No tiene un área institucional activa asignada.');
    expect(element.querySelector('tbody')).toBeNull();
  });

  it('filtra por nombre y estado sin solicitar ni seleccionar otras áreas', async () => {
    const fixture = TestBed.createComponent(AreaUsers);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/usuarios/mi-area').flush([
      {
        id: 1,
        userName: 'qa.activo',
        nombreCompleto: 'Ana QA',
        activo: true,
        roles: ['PersonalArea'],
      },
      {
        id: 2,
        userName: 'qa.inactivo',
        nombreCompleto: 'Luis QA',
        activo: false,
        roles: ['PersonalArea'],
      },
    ]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector('select')!;
    select.value = 'inactive';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelector('tbody')?.textContent).toContain('Luis QA');
    expect(element.querySelector('tbody')?.textContent).not.toContain('Ana QA');
    expect(element.querySelectorAll('select')).toHaveLength(1);
    http.expectNone('/api/areas');
  });
});
