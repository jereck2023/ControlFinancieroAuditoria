import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentsApi } from './documents-api';

describe('Fecha de importación de Documentos (HTTP simulado)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it.each([
    ['2026-11-15T04:53:32.7419396', '2026-11-15T04:53:32.7419396Z'],
    ['2026-11-15T04:53:32.7419396Z', '2026-11-15T04:53:32.7419396Z'],
    ['2026-11-14T23:53:32.7419396-05:00', '2026-11-14T23:53:32.7419396-05:00'],
  ])('normaliza %s en listado y detalle sin mutar la respuesta original', (input, expected) => {
    const document = {
      documentoFinancieroId: 2014,
      nombreArchivo: 'Documento QA.xlsx',
      areaId: 2025,
      nombreArea: 'Área QA',
      usuarioId: 3035,
      nombreUsuario: 'Persona QA',
      fechaImportacion: input,
      totalRegistros: 12,
      hashArchivo: 'hash-qa',
    };
    const http = TestBed.inject(HttpTestingController),
      api = TestBed.inject(DocumentsApi);
    api
      .list()
      .subscribe((items) => expect(items[0]).toEqual({ ...document, fechaImportacion: expected }));
    http.expectOne('/api/documentos-financieros').flush([document]);
    api
      .get(2014)
      .subscribe((item) => expect(item).toEqual({ ...document, fechaImportacion: expected }));
    http.expectOne('/api/documentos-financieros/2014').flush(document);
    expect(document.fechaImportacion).toBe(input);
    http.expectNone((request) => request.method !== 'GET');
  });
});
