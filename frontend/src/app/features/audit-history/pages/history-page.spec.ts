import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { HistoryPage } from './history-page';
import { stubDialogMethods } from '../../../shared/ui/dialog-test-support';

describe('History consultation UI (mocked HTTP)', () => {
  let restoreDialog: () => void;
  beforeEach(() => {
    restoreDialog = stubDialogMethods();
  });
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    restoreDialog();
  });
  const row = {
    historialAuditoriaId: 1,
    registroFinancieroId: 8,
    documentoFinancieroId: null,
    nombreDocumento: 'Sin documento de origen',
    areaId: 2,
    nombreArea: 'QA',
    usuarioId: 3,
    nombreUsuario: 'Usuario QA',
    fechaHora: '2026-11-11T10:00:00',
    tipoAccion: 'Modificacion',
  };
  it('requests another server page and resets to page one after applying filters', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne(
        (item) => item.url === '/api/historial-auditoria' && item.params.get('pagina') === '1',
      )
      .flush({
        pagina: 1,
        tamanoPagina: 20,
        totalRegistros: 21,
        totalPaginas: 2,
        registros: [row],
      });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Siguiente')
      ?.click();
    http
      .expectOne(
        (item) => item.url === '/api/historial-auditoria' && item.params.get('pagina') === '2',
      )
      .flush({
        pagina: 2,
        tamanoPagina: 20,
        totalRegistros: 21,
        totalPaginas: 2,
        registros: [row],
      });
    await fixture.whenStable();
    const input = element.querySelector<HTMLInputElement>('#trace-record');
    if (!input) throw new Error('Missing record filter');
    input.value = '8';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http
      .expectOne(
        (item) =>
          item.params.get('pagina') === '1' && item.params.get('registroFinancieroId') === '8',
      )
      .flush({ pagina: 1, tamanoPagina: 20, totalRegistros: 0, totalPaginas: 0, registros: [] });
    await fixture.whenStable();
    expect(element.textContent).toContain('No se encontraron eventos');
  });
  it('renders descriptive HTML as text and exposes no mutation or export controls', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((item) => item.url === '/api/historial-auditoria')
      .flush({ pagina: 1, tamanoPagina: 20, totalRegistros: 1, totalPaginas: 1, registros: [row] });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('[aria-label="Ver cambios del historial 1"]')?.click();
    http.expectOne('/api/historial-auditoria/1').flush(
      JSON.stringify({
        ...row,
        valoresModificados: {
          Anteriores: { Descripcion: 'Antes' },
          Nuevos: { Descripcion: '<script>Prueba</script>' },
        },
      }),
    );
    await fixture.whenStable();
    expect(element.textContent).toContain('<script>Prueba</script>');
    expect(element.querySelector('script')).toBeNull();
    expect(element.textContent).not.toContain('Eliminar');
    expect(element.textContent).not.toContain('Exportar');
    expect(element.querySelector('dialog')?.open).toBe(true);
    expect(element.querySelector('#history-detail')).toBeNull();
    expect(element.querySelector('pre, details')).toBeNull();
    expect(element.textContent).not.toContain('Ver contenido completo');
    element.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(element.querySelector('dialog')).toBeNull();
    expect(element.querySelector('tbody')?.textContent).toContain('Usuario QA');
    http.expectNone((item) => item.url === '/api/historial-auditoria');
  });
});
