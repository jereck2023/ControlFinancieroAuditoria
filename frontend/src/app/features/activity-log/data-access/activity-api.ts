import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { traceHttpParams } from '../../../shared/traceability/trace-query';
import { ActivityQuery } from '../models/requests/activity-query';
import {
  ActivityDetailResponse,
  ActivityPageResponse,
} from '../models/responses/activity-responses';
@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/bitacora-actividades`;
  list(query: ActivityQuery) {
    return this.http.get<ActivityPageResponse>(this.url, { params: traceHttpParams(query) });
  }
  detail(id: number) {
    return this.http.get<ActivityDetailResponse>(`${this.url}/${id}`);
  }
}
