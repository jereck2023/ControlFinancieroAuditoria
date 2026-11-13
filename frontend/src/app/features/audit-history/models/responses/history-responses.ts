import { ServerPage } from '../../../../shared/traceability/trace-query';
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface HistoryRowResponse {
  historialAuditoriaId: number;
  registroFinancieroId: number;
  documentoFinancieroId: number | null;
  nombreDocumento: string;
  areaId: number;
  nombreArea: string;
  usuarioId: number;
  nombreUsuario: string;
  fechaHora: string;
  tipoAccion: string;
}
export interface HistoryDetailResponse extends HistoryRowResponse {
  valoresModificados: JsonValue;
}
export type HistoryPageResponse = ServerPage<HistoryRowResponse>;
