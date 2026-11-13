import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { HistoryApi } from './history-api';
import { ActivityApi } from '../../activity-log/data-access/activity-api';

describe('Traceability GET contracts (simulated HTTP)', () => {
  let testing: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    testing = TestBed.inject(HttpTestingController);
  });
  afterEach(() => testing.verify());
  it('sends supported history filters and server pagination exactly', () => {
    TestBed.inject(HistoryApi)
      .list({
        pagina: 2,
        tamanoPagina: 10,
        registroFinancieroId: 8,
        tipoAccion: 'Modificacion',
        fechaHasta: '2026-11-11T23:59:59.9999999Z',
      })
      .subscribe();
    const request = testing.expectOne((item) => item.url === '/api/historial-auditoria');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('pagina')).toBe('2');
    expect(request.request.params.get('tamanoPagina')).toBe('10');
    expect(request.request.params.get('registroFinancieroId')).toBe('8');
    expect(request.request.params.get('fechaHasta')).toBe('2026-11-11T23:59:59.9999999Z');
    request.flush({
      pagina: 2,
      tamanoPagina: 10,
      totalRegistros: 0,
      totalPaginas: 0,
      registros: [],
    });
  });
  it('queries activity by exact type and uses the actual detail endpoint', () => {
    TestBed.inject(ActivityApi)
      .list({
        pagina: 1,
        tamanoPagina: 20,
        tipoActividad: 'LoginExitoso',
        documentoFinancieroId: 4,
      })
      .subscribe();
    const list = testing.expectOne((item) => item.url === '/api/bitacora-actividades');
    expect(list.request.params.get('tipoActividad')).toBe('LoginExitoso');
    expect(list.request.params.has('resultado')).toBe(false);
    expect(list.request.params.has('registroFinancieroId')).toBe(false);
    list.flush({});
    TestBed.inject(ActivityApi).detail(7).subscribe();
    const detail = testing.expectOne('/api/bitacora-actividades/7');
    expect(detail.request.method).toBe('GET');
    detail.flush({});
  });
});
