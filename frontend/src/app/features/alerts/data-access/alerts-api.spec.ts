import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AlertsApi } from './alerts-api';
import { alertFixture, alertPage } from '../testing/alert-fixture';
describe('Alerts HTTP contracts (simulated)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it('queries only the real filters with the unaccented wire state', () => {
    TestBed.inject(AlertsApi)
      .list({
        pagina: 2,
        tamanoPagina: 10,
        estado: 'En revision',
        reglaAnomaliaId: 1,
        areaId: 2,
        usuarioId: 3,
        fechaDesde: '2026-11-11T00:00:00.0000000Z',
        fechaHasta: '2026-11-11T23:59:59.9999999Z',
      })
      .subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne((r) => r.url === '/api/alertas');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toHaveLength(8);
    expect(req.request.params.get('estado')).toBe('En revision');
    req.flush(alertPage());
  });
  it('reads complete detail and writes only the supported transitions with RowVersion', () => {
    const api = TestBed.inject(AlertsApi),
      http = TestBed.inject(HttpTestingController);
    api.detail(7).subscribe();
    http.expectOne('/api/alertas/7').flush(alertFixture());
    api.startReview(7, { rowVersion: 'AAAAAAAAAAE=' }).subscribe();
    const start = http.expectOne('/api/alertas/7/iniciar-revision');
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({ rowVersion: 'AAAAAAAAAAE=' });
    start.flush({ mensaje: 'OK' });
    api
      .close(7, {
        estado: 'Descartada',
        justificacion: 'Justificación QA',
        rowVersion: 'AAAAAAAAAAI=',
      })
      .subscribe();
    const close = http.expectOne('/api/alertas/7/cerrar');
    expect(close.request.method).toBe('POST');
    expect(close.request.body).toEqual({
      estado: 'Descartada',
      justificacion: 'Justificación QA',
      rowVersion: 'AAAAAAAAAAI=',
    });
    close.flush({ mensaje: 'OK' });
  });
});
