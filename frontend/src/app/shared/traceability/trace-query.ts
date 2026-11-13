import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { HttpParams } from '@angular/common/http';

export interface TraceFiltersValue {
  usuarioId: number | null;
  documentoFinancieroId: number | null;
  registroFinancieroId: number | null;
  tipoAccion: '' | 'Creacion' | 'Modificacion';
  tipoActividad: string;
  fechaDesde: string;
  fechaHasta: string;
  tamanoPagina: number;
}
export interface TraceQueryBase {
  usuarioId?: number;
  documentoFinancieroId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina: number;
  tamanoPagina: number;
}
export interface ServerPage<T> {
  pagina: number;
  tamanoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  registros: T[];
}

export const optionalId: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value === null ||
  control.value === '' ||
  (typeof control.value === 'number' &&
    Number.isInteger(control.value) &&
    control.value > 0 &&
    control.value <= 2147483647)
    ? null
    : { identifier: true };

export function utcQueryDate(value: string, endOfSecond = false): string | undefined {
  if (!value) return undefined;
  const normalized = value.length === 16 ? value + ':00' : value;
  return normalized + (endOfSecond ? '.9999999Z' : '.0000000Z');
}
export const optionalUtcDate: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  if (value === '') return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) ||
    value.slice(0, 4) === '0000'
  )
    return { utcDate: true };
  const normalized = value.length === 16 ? value + ':00' : value;
  const date = new Date(normalized + 'Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === normalized
    ? null
    : { utcDate: true };
};
export const utcDateRange: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const from: unknown = control.get('fechaDesde')?.value;
  const until: unknown = control.get('fechaHasta')?.value;
  return typeof from === 'string' &&
    typeof until === 'string' &&
    from &&
    until &&
    utcQueryDate(from)! > utcQueryDate(until, true)!
    ? { dateRange: true }
    : null;
};

export function baseTraceQuery(value: TraceFiltersValue): TraceQueryBase {
  return {
    pagina: 1,
    tamanoPagina: value.tamanoPagina,
    ...(value.usuarioId !== null ? { usuarioId: value.usuarioId } : {}),
    ...(value.documentoFinancieroId !== null
      ? { documentoFinancieroId: value.documentoFinancieroId }
      : {}),
    ...(value.fechaDesde ? { fechaDesde: utcQueryDate(value.fechaDesde) } : {}),
    ...(value.fechaHasta ? { fechaHasta: utcQueryDate(value.fechaHasta, true) } : {}),
  };
}
export function traceHttpParams(
  query: TraceQueryBase & {
    registroFinancieroId?: number;
    tipoAccion?: string;
    tipoActividad?: string;
  },
): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') params = params.set(key, String(value));
  return params;
}
