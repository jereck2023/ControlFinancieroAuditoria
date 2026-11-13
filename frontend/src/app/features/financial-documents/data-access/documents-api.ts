import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DocumentResponse, DocumentDetailResponse } from '../models/responses/document-response';
import { decodeRecords } from '../../financial-records/data-access/record-codec';

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/documentos-financieros`;
  list() {
    return this.http.get<DocumentResponse[]>(this.url);
  }
  get(id: number) {
    return this.http.get<DocumentDetailResponse>(`${this.url}/${id}`);
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
