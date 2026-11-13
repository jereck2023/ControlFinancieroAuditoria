import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { RecordsApi } from './records-api';
import { DocumentsApi } from '../../financial-documents/data-access/documents-api';
import { ImportApi } from '../../financial-import/data-access/import-api';

describe('Module 4 HTTP contracts (mocked)', () => {
  let testing: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    testing = TestBed.inject(HttpTestingController);
  });
  afterEach(() => testing.verify());
  it('does not invent server-side pagination or filters on full-list endpoints', () => {
    TestBed.inject(RecordsApi)
      .list()
      .subscribe((value) => expect(value).toEqual([]));
    const request = testing.expectOne('/api/registros-financieros');
    expect(request.request.params.keys()).toEqual([]);
    request.flush('[]');
    TestBed.inject(DocumentsApi).list().subscribe();
    testing.expectOne('/api/documentos-financieros').flush([]);
  });
  it('sends the original rowVersion and exact numeric amount in a PUT', () => {
    TestBed.inject(RecordsApi)
      .update(
        8,
        {
          tipoOperacion: 'Egreso',
          descripcion: 'Actualización',
          fechaOperacion: '2026-11-11',
          monto: '9999999999999999.99',
        },
        'AAAAAAAAAAE=',
      )
      .subscribe();
    const request = testing.expectOne('/api/registros-financieros/8');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Content-Type')).toBe('application/json');
    expect(request.request.body).toContain('"rowVersion":"AAAAAAAAAAE="');
    expect(request.request.body).toContain('"monto":9999999999999999.99');
    request.flush({ mensaje: 'ok', registroId: 8 });
  });
  it('uses multipart archivo and server hash only at confirmation', () => {
    const file = new File(['fixture'], 'prueba.xlsx');
    const api = TestBed.inject(ImportApi);
    api.preview({ archivo: file }).subscribe();
    const preview = testing.expectOne('/api/registros-financieros/importar/vista-previa');
    expect(preview.request.headers.has('Content-Type')).toBe(false);
    expect(preview.request.body.get('archivo')).toBe(file);
    expect(preview.request.body.has('hashArchivo')).toBe(false);
    preview.flush(
      '{"totalFilas":0,"registros":[],"errores":[],"esValido":false,"hashArchivo":"HASH"}',
    );
    api.confirm({ archivo: file, hashArchivo: 'HASH' }).subscribe();
    const confirm = testing.expectOne('/api/registros-financieros/importar/confirmar');
    expect(confirm.request.body.get('archivo')).toBe(file);
    expect(confirm.request.body.get('hashArchivo')).toBe('HASH');
    confirm.flush({});
  });
  it('downloads the document from the existing authenticated endpoint', () => {
    TestBed.inject(DocumentsApi).export(4).subscribe();
    const request = testing.expectOne('/api/documentos-financieros/4/exportar');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.method).toBe('GET');
    request.flush(new Blob(['PK']));
  });
});
