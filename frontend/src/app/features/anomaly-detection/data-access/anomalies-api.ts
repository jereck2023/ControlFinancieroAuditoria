import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DetectAnomaliesRequest } from '../models/requests/detect-anomalies-request';
import { DetectionResponse } from '../models/responses/detection-response';
export function decodeDetection(value: unknown): DetectionResponse {
  if (!value || typeof value !== 'object')
    throw new Error('La respuesta de detección no tiene el formato esperado.');
  const item = value as Record<string, unknown>;
  if (
    typeof item['mensaje'] !== 'string' ||
    !item['mensaje'].trim() ||
    typeof item['nuevasAlertas'] !== 'number' ||
    !Number.isSafeInteger(item['nuevasAlertas']) ||
    item['nuevasAlertas'] < 0
  )
    throw new Error('La respuesta de detección no tiene el formato esperado.');
  return { mensaje: item['mensaje'], nuevasAlertas: item['nuevasAlertas'] };
}
@Injectable({ providedIn: 'root' })
export class AnomaliesApi {
  private readonly http = inject(HttpClient);
  detect() {
    const body: DetectAnomaliesRequest = null;
    return this.http
      .post<unknown>(`${environment.apiBaseUrl}/anomalias/detectar`, body)
      .pipe(map(decodeDetection));
  }
}
