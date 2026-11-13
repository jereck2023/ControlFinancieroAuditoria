import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  AlertQuery,
  StartReviewRequest,
  CloseAlertRequest,
} from '../models/requests/alert-requests';
import {
  AlertPageResponse,
  AlertDetailResponse,
  StartReviewResponse,
  CloseAlertResponse,
} from '../models/responses/alert-responses';
@Injectable({ providedIn: 'root' })
export class AlertsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/alertas`;
  list(query: AlertQuery) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    return this.http.get<AlertPageResponse>(this.url, { params });
  }
  detail(id: number) {
    return this.http.get<AlertDetailResponse>(`${this.url}/${id}`);
  }
  startReview(id: number, request: StartReviewRequest) {
    return this.http.post<StartReviewResponse>(`${this.url}/${id}/iniciar-revision`, request);
  }
  close(id: number, request: CloseAlertRequest) {
    return this.http.post<CloseAlertResponse>(`${this.url}/${id}/cerrar`, request);
  }
}
