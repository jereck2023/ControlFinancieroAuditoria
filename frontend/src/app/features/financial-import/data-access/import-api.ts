import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { parseFinancialJson } from '../../financial-records/models/financial-decimal';
import { PreviewImportRequest, ConfirmImportRequest } from '../models/requests/import-requests';
import { ConfirmImportResponse } from '../models/responses/import-responses';
import { ImportPreviewView } from '../models/import-preview-view';

export function decodePreview(text: string): ImportPreviewView {
  const value = parseFinancialJson(text);
  if (!value || typeof value !== 'object') throw new Error('Vista previa no válida.');
  const p = value as Record<string, unknown>;
  if (
    typeof p['totalFilas'] !== 'number' ||
    typeof p['hashArchivo'] !== 'string' ||
    typeof p['esValido'] !== 'boolean' ||
    !Array.isArray(p['registros']) ||
    !Array.isArray(p['errores'])
  )
    throw new Error('Formato de vista previa no reconocido.');
  if (
    !p['registros'].every(
      (row: unknown) =>
        !!row &&
        typeof row === 'object' &&
        'monto' in row &&
        typeof row.monto === 'string' &&
        'numeroFila' in row &&
        typeof row.numeroFila === 'number' &&
        'descripcion' in row &&
        typeof row.descripcion === 'string' &&
        'fechaOperacion' in row &&
        typeof row.fechaOperacion === 'string' &&
        'tipoOperacion' in row &&
        (row.tipoOperacion === 'Ingreso' || row.tipoOperacion === 'Egreso'),
    ) ||
    !p['errores'].every(
      (error: unknown) =>
        !!error &&
        typeof error === 'object' &&
        'numeroFila' in error &&
        typeof error.numeroFila === 'number' &&
        'mensaje' in error &&
        typeof error.mensaje === 'string',
    )
  )
    throw new Error('Filas o errores de vista previa no reconocidos.');
  // Every field has been checked; the adapter changes only decimal representation.
  return value as ImportPreviewView;
}

@Injectable({ providedIn: 'root' })
export class ImportApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/registros-financieros/importar`;
  preview(request: PreviewImportRequest) {
    const form = new FormData();
    form.append('archivo', request.archivo);
    return this.http
      .post(`${this.url}/vista-previa`, form, { responseType: 'text' })
      .pipe(map(decodePreview));
  }
  confirm(request: ConfirmImportRequest) {
    const form = new FormData();
    form.append('archivo', request.archivo);
    form.append('hashArchivo', request.hashArchivo);
    return this.http.post<ConfirmImportResponse>(`${this.url}/confirmar`, form);
  }
}
