import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AreaResponse } from '../models/responses/area-response';
import { CreateAreaRequest, UpdateAreaRequest } from '../models/requests/area-requests';

@Injectable({ providedIn: 'root' })
export class AreasApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/areas`;
  list() {
    return this.http.get<AreaResponse[]>(this.url);
  }
  create(request: CreateAreaRequest) {
    return this.http.post<AreaResponse>(this.url, request);
  }
  update(id: number, request: UpdateAreaRequest) {
    return this.http.put<AreaResponse>(`${this.url}/${id}`, request);
  }
  setActive(id: number, active: boolean) {
    return this.http.patch<AreaResponse>(
      `${this.url}/${id}/${active ? 'activar' : 'desactivar'}`,
      {},
    );
  }
}
