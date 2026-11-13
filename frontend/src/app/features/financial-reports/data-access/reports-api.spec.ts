import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReportsApi } from './reports-api';
import { ReportQuery } from '../models/requests/report-query';
const query: ReportQuery = {
  fechaDesde: '2026-11-01',
  fechaHasta: '2026-11-30',
  tipoOperacion: 'Egreso',
  areaId: 2,
  documentoFinancieroId: 3,
  soloSinDocumento: false,
  agrupacion: 'Documento',
  pagina: 2,
  tamanoPagina: 10,
};
describe('Reports HTTP contracts (simulated)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it.each(['resumen', 'detalle'] as const)(
    'requests %s only with supported query parameters',
    (kind) => {
      TestBed.inject(ReportsApi)
        .generate({ kind, query })
        .subscribe({ error: () => {} });
      const req = TestBed.inject(HttpTestingController).expectOne(
        (r) => r.url === `/api/reportes-financieros/${kind}`,
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('text');
      expect(
        Object.fromEntries(
          req.request.params.keys().map((key) => [key, req.request.params.get(key)]),
        ),
      ).toEqual(
        Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])),
      );
      req.flush('{}');
    },
  );
  it.each(['resumen', 'detalle'] as const)(
    'exports complete %s filters independently of current page',
    (kind) => {
      TestBed.inject(ReportsApi).export({ kind, query }).subscribe();
      const req = TestBed.inject(HttpTestingController).expectOne(
        (r) => r.url === `/api/reportes-financieros/${kind}/exportar`,
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      expect(req.request.params.get('pagina')).toBe('1');
      expect(req.request.params.get('documentoFinancieroId')).toBe('3');
      req.flush(new Blob(['PK']));
    },
  );
});
