import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RecordFormValue } from '../models/record-view';
import { RecordQuery } from '../models/requests/record-query';
import { CreateRecordResponse, UpdateRecordResponse } from '../models/responses/record-response';
import { decodeRecord, decodeRecords, encodeRecord } from './record-codec';

@Injectable({ providedIn: 'root' })
export class RecordsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/registros-financieros`;
  list(query: RecordQuery = {}) {
    const params: Record<string, string> = {};
    if (query.registroFinancieroId !== undefined)
      params['registroFinancieroId'] = String(query.registroFinancieroId);
    return this.http.get(this.url, { params, responseType: 'text' }).pipe(map(decodeRecords));
  }
  get(id: number) {
    return this.http.get(`${this.url}/${id}`, { responseType: 'text' }).pipe(map(decodeRecord));
  }
  create(value: RecordFormValue) {
    return this.http.post<CreateRecordResponse>(this.url, encodeRecord(value), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  update(id: number, value: RecordFormValue, rowVersion: string) {
    return this.http.put<UpdateRecordResponse>(
      `${this.url}/${id}`,
      encodeRecord(value, rowVersion),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }
  exportAll() {
    return this.http.get(`${this.url}/exportar`, { responseType: 'blob', observe: 'response' });
  }
}
