export type AlertState = 'Pendiente' | 'En revision' | 'Resuelta' | 'Descartada';
export type ClosedAlertState = 'Resuelta' | 'Descartada';
export interface AlertQuery {
  estado?: AlertState;
  reglaAnomaliaId?: number;
  areaId?: number;
  usuarioId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina: number;
  tamanoPagina: number;
}
export interface StartReviewRequest {
  rowVersion: string;
}
export interface CloseAlertRequest extends StartReviewRequest {
  estado: ClosedAlertState;
  justificacion: string;
}
export type AlertAction =
  { kind: 'start'; request: StartReviewRequest } | { kind: 'close'; request: CloseAlertRequest };
