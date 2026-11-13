import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ReportQuery, ReportSelection } from '../models/requests/report-query';
import { ReportResult } from '../models/report-view';
import { decodeDetail, decodeSummary } from './report-codec';
export function reportParams(query: ReportQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params = params.set(key, String(value));
  return params;
}
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/reportes-financieros`;
  generate(selection: ReportSelection): Observable<ReportResult> {
    return this.http
      .get(`${this.url}/${selection.kind}`, {
        params: reportParams(selection.query),
        responseType: 'text',
      })
      .pipe(
        map((text) =>
          selection.kind === 'resumen'
            ? { kind: 'resumen' as const, data: decodeSummary(text) }
            : { kind: 'detalle' as const, data: decodeDetail(text) },
        ),
      );
  }
  export(selection: ReportSelection) {
    return this.http.get(`${this.url}/${selection.kind}/exportar`, {
      params: reportParams({ ...selection.query, pagina: 1 }),
      responseType: 'blob',
      observe: 'response',
    });
  }
}
