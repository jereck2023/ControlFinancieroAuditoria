import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AreasApi } from '../../areas/data-access/areas-api';
import { ReportsPage } from './reports-page';
import { Session } from '../../../core/auth/session';
const filters = {
  fechaDesde: '2026-11-01',
  fechaHasta: '2026-11-30',
  tipoOperacion: null,
  areaId: null,
  documentoFinancieroId: null,
  soloSinDocumento: false,
  agrupacion: 'Ninguna',
  pagina: 1,
  tamanoPagina: 20,
};
describe('Report pages (simulated HTTP)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        {
          provide: AreasApi,
          useValue: { list: () => of([{ areaId: 2, nombre: 'QA', activo: true }]) },
        },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { identity: signal({ roles: ['Auditor'] }) } },
      ],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it('does not query before Generate, displays zero totals and removes stale results after 403', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    http.expectNone((r) => r.url.includes('reportes-financieros'));
    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http
      .expectOne((r) => r.url.endsWith('/resumen'))
      .flush(
        JSON.stringify({
          cantidadIngresos: 0,
          totalIngresos: 0,
          cantidadEgresos: 0,
          totalEgresos: 0,
          diferencia: 0,
          agrupacion: 'Ninguna',
          filtrosAplicados: filters,
          pagina: 1,
          tamanoPagina: 20,
          totalGrupos: 0,
          totalPaginas: 0,
          grupos: [],
        }),
      );
    await fixture.whenStable();
    expect(el.textContent).toContain('No se encontraron operaciones');
    expect(el.textContent).toContain('no representa saldo disponible');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http
      .expectOne((r) => r.url.endsWith('/resumen'))
      .flush({ mensaje: 'Área no autorizada' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Área no autorizada');
    expect(el.querySelector('app-report-totals')).toBeNull();
  });
  it('paginates detail on the server and renders descriptions as text', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const kind = el.querySelector<HTMLSelectElement>('#report-kind')!;
    kind.value = 'detalle';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    el.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    const row = {
      registroFinancieroId: 2,
      fechaOperacion: '2026-11-11',
      tipoOperacion: 'Egreso',
      descripcion: '<b>Solo texto</b>',
      monto: 0.25,
      areaId: 1,
      nombreArea: 'QA',
      usuarioId: 1,
      nombreUsuario: 'QA',
      documentoFinancieroId: null,
      nombreDocumento: 'Sin documento de origen',
    };
    const result = {
      totalRegistros: 21,
      pagina: 1,
      tamanoPagina: 20,
      totalPaginas: 2,
      filtrosAplicados: filters,
      registros: [row],
    };
    http.expectOne((r) => r.url.endsWith('/detalle')).flush(JSON.stringify(result));
    await fixture.whenStable();
    expect(el.textContent).toContain('<b>Solo texto</b>');
    expect(el.querySelector('app-report-movements b')).toBeNull();
    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Siguiente')!
      .click();
    http
      .expectOne((r) => r.params.get('pagina') === '2')
      .flush(JSON.stringify({ ...result, pagina: 2 }));
    await fixture.whenStable();
    expect(el.textContent).toContain('Página 2 de 2');
    el.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    http
      .expectOne((r) => r.params.get('pagina') === '1')
      .flush(JSON.stringify({ ...result, totalRegistros: 0, totalPaginas: 0, registros: [] }));
    await fixture.whenStable();
    expect(el.textContent).toContain('No hay operaciones en esta página');
  });
  it('exports applied filters and recovers from the server export limit', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    el.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    const generated = http.expectOne((r) => r.url.endsWith('/resumen'));
    const originalFrom = generated.request.params.get('fechaDesde');
    generated.flush(
      JSON.stringify({
        cantidadIngresos: 1,
        totalIngresos: 10,
        cantidadEgresos: 0,
        totalEgresos: 0,
        diferencia: 10,
        agrupacion: 'Ninguna',
        filtrosAplicados: filters,
        pagina: 1,
        tamanoPagina: 20,
        totalGrupos: 0,
        totalPaginas: 0,
        grupos: [],
      }),
    );
    await fixture.whenStable();
    const from = el.querySelector<HTMLInputElement>('#report-from')!;
    from.value = '2026-12-01';
    from.dispatchEvent(new Event('input', { bubbles: true }));
    const button = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Exportar reporte a Excel',
    )!;
    button.click();
    const exported = http.expectOne((r) => r.url.endsWith('/resumen/exportar'));
    expect(exported.request.params.get('fechaDesde')).toBe(originalFrom);
    const message =
      '{"mensaje":"La exportación supera el límite de 10000 operaciones. Reduzca el período o los filtros."}';
    const body = new Blob([message], { type: 'application/json' });
    // jsdom Blob lacks text(); browsers provide it. Keep a Blob-shaped HTTP error.
    if (!body.text) Object.defineProperty(body, 'text', { value: async () => message });
    exported.flush(body, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(el.textContent).toContain('La exportación supera el límite');
    expect(button.disabled).toBe(false);
    expect(el.querySelector('app-report-totals')).not.toBeNull();
  });
});
