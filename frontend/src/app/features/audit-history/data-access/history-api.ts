import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { traceHttpParams } from '../../../shared/traceability/trace-query';
import { HistoryQuery } from '../models/requests/history-query';
import { HistoryPageResponse } from '../models/responses/history-responses';
import { decodeHistoryDetail } from '../models/history-detail-view';
@Injectable({ providedIn: 'root' })
export class HistoryApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/historial-auditoria`;
  list(query: HistoryQuery) {
    return this.http.get<HistoryPageResponse>(this.url, { params: traceHttpParams(query) });
  }
  detail(id: number) {
    return this.http
      .get(`${this.url}/${id}`, { responseType: 'text' })
      .pipe(map(decodeHistoryDetail));
  }
}
