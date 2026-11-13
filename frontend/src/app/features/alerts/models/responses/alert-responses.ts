import { AlertState, ClosedAlertState } from '../requests/alert-requests';
export interface AlertRowResponse {
  alertaId: number;
  estado: AlertState;
  titulo: string;
  descripcion: string;
  fechaHoraEvento: string;
  fechaHoraDeteccion: string;
  reglaAnomaliaId: number;
  codigoRegla: string;
  nombreRegla: string;
  usuarioId: number | null;
  nombreUsuario: string | null;
  areaId: number | null;
  nombreArea: string | null;
  registroFinancieroId: number | null;
}
export interface AlertPageResponse {
  totalRegistros: number;
  pagina: number;
  tamanoPagina: number;
  totalPaginas: number;
  alertas: AlertRowResponse[];
}
export interface AlertDetailResponse extends AlertRowResponse {
  descripcionRegla: string;
  campoModificado: string | null;
  evidenciasJson: string;
  usuarioRevisionId: number | null;
  fechaInicioRevisionUtc: string | null;
  usuarioCierreId: number | null;
  fechaCierreUtc: string | null;
  justificacionCierre: string | null;
  rowVersion: string;
}
export interface StartReviewResponse {
  mensaje: string;
  alertaId: number;
  estado: 'En revision';
  usuarioRevisionId: number;
  fechaInicioRevisionUtc: string;
  rowVersion: string;
}
export interface CloseAlertResponse {
  mensaje: string;
  alertaId: number;
  estado: ClosedAlertState;
  usuarioCierreId: number;
  fechaCierreUtc: string;
  justificacionCierre: string;
  rowVersion: string;
}
