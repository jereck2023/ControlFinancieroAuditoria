import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { ActivityPage } from './activity-page';

describe('Activity consultation UI (mocked HTTP)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [ActivityPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  const row = {
    bitacoraActividadId: 4,
    fechaHora: '2026-11-11T10:00:00',
    tipoActividad: 'LoginFallido',
    resultado: 'Fallido',
    usuarioId: null,
    nombreUsuario: 'Usuario QA',
    areaId: null,
    nombreArea: null,
    documentoFinancieroId: null,
    nombreDocumento: null,
    registroFinancieroId: null,
  };
  it('handles missing references and nullable detail without inventing filters or links', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((item) => item.url === '/api/bitacora-actividades')
      .flush({ pagina: 1, tamanoPagina: 20, totalRegistros: 1, totalPaginas: 1, registros: [row] });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Sin referencia');
    expect(element.querySelector('#trace-record')).toBeNull();
    expect(element.querySelector('a[href^="/documentos/"]')).toBeNull();
    element.querySelector<HTMLButtonElement>('[aria-label="Ver actividad 4"]')?.click();
    http
      .expectOne('/api/bitacora-actividades/4')
      .flush({ ...row, direccionIp: null, detalle: null });
    await fixture.whenStable();
    expect(element.textContent).toContain('No registrada');
    expect(element.textContent).toContain('Sin detalle adicional registrado.');
  });
  it('clears old rows and detail after a forbidden refresh', async () => {
    const fixture = TestBed.createComponent(ActivityPage);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((item) => item.url === '/api/bitacora-actividades')
      .flush({ pagina: 1, tamanoPagina: 20, totalRegistros: 1, totalPaginas: 1, registros: [row] });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Actualizar consulta')
      ?.click();
    http
      .expectOne((item) => item.url === '/api/bitacora-actividades')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(element.textContent).toContain('No tiene permiso');
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).not.toContain('Usuario QA');
  });
});
