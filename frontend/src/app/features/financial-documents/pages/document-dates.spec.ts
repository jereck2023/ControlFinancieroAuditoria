import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentsList } from './documents-list';
import { DocumentDetail } from './document-detail';

describe('Importación en hora de Perú (páginas, HTTP simulado)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [DocumentsList, DocumentDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '2014' }) } },
        },
      ],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it.each([
    ['2026-11-15T04:53:32.7419396', '14/11/2026 23:53'],
    ['2026-11-15T05:00:00Z', '15/11/2026 00:00'],
    ['2026-01-01T04:59:59Z', '31/12/2025 23:59'],
  ])('muestra %s como %s en listado y detalle', async (timestamp, expected) => {
    const document = {
      documentoFinancieroId: 2014,
      nombreArchivo: 'Documento QA.xlsx',
      areaId: 2025,
      nombreArea: 'Área QA',
      usuarioId: 3035,
      nombreUsuario: 'Persona QA',
      fechaImportacion: timestamp,
      totalRegistros: 12,
      hashArchivo: 'hash-qa',
    };
    const http = TestBed.inject(HttpTestingController);
    const list = TestBed.createComponent(DocumentsList);
    http.expectOne('/api/documentos-financieros').flush([document]);
    await list.whenStable();
    const listElement = list.nativeElement as HTMLElement;
    expect(listElement.querySelector('thead')?.textContent).toContain('Importación (hora de Perú)');
    expect(listElement.querySelector('tbody')?.textContent).toContain(expected);
    expect(listElement.querySelector('tbody')?.textContent).not.toContain('15/11/2026 09:53');
    const detail = TestBed.createComponent(DocumentDetail);
    http.expectOne('/api/documentos-financieros/2014').flush(document);
    http.expectOne('/api/documentos-financieros/2014/registros').flush('[]');
    await detail.whenStable();
    const detailElement = detail.nativeElement as HTMLElement;
    expect(detailElement.querySelector('dl')?.textContent).toContain('Importación (hora de Perú)');
    expect(detailElement.querySelector('dl')?.textContent).toContain(expected);
    expect(detailElement.querySelector('dl')?.textContent).toContain('12');
    expect(detailElement.textContent).toContain('hash-qa');
    http.expectNone((request) => request.method !== 'GET');
  });
});
