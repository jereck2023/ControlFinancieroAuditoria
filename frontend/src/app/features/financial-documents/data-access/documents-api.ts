import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DocumentResponse, DocumentDetailResponse } from '../models/responses/document-response';
import { decodeRecords } from '../../financial-records/data-access/record-codec';

/** SQL stores UTC, but EF can serialize its DateTime values without a timezone suffix. */
function normalizeImportDate<T extends DocumentResponse>(document: T): T {
  const timestamp = document.fechaImportacion;
  return {
    ...document,
    fechaImportacion: /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : timestamp + 'Z',
  };
}

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/documentos-financieros`;
  list() {
    return this.http
      .get<DocumentResponse[]>(this.url)
      .pipe(map((documents) => documents.map(normalizeImportDate)));
  }
  get(id: number) {
    return this.http
      .get<DocumentDetailResponse>(`${this.url}/${id}`)
      .pipe(map((document) => normalizeImportDate(document)));
  }
  records(id: number) {
    return this.http
      .get(`${this.url}/${id}/registros`, { responseType: 'text' })
      .pipe(map(decodeRecords));
  }
  export(id: number) {
    return this.http.get(`${this.url}/${id}/exportar`, {
      responseType: 'blob',
      observe: 'response',
    });
  }
}
